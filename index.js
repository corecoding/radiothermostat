var Service, Characteristic;
var request = require('request');

module.exports = function(homebridge){
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-radiothermostat', 'RadioThermostat', Thermostat);
};

function fahrenheitToCelsius(temp) {
  temp = (temp - 32) * (5/9);
  if (temp < 0) temp = 0;
  return temp;
}

function celsiusToFahrenheit(temp) {
  return (temp * (9/5)) + 32;
}

function stamp() {
  return parseInt(new Date() / 1000);
}

function Thermostat(log, config) {
  this.log = log;
  this.maxTemp = config.maxTemp || 24;
  this.minTemp = config.minTemp || 15;
  this.name = config.name;
  this.apiroute = config.apiroute || 'apiroute';
  this.log(this.name, this.apiroute);

  this.currentTemperature = 19;
  this.targetTemperature = 21;
  this.currentRelativeHumidity = 0;
  this.heatingThresholdTemperature = 24;
  this.coolingThresholdTemperature = 5;
  this.lastUpdate = 0;
  this.querying = false;
  this.lastJson = '';

  // Use CELSIUS or FAHRENHEIT
  this.currentTemperatureeratureDisplayUnits = Characteristic.TemperatureDisplayUnits.FAHRENHEIT;

  // The value property of CurrentHeatingCoolingState must be OFF, HEAT, COOL or AUTO
  this.heatingCoolingState = Characteristic.CurrentHeatingCoolingState.AUTO;

  // The value property of TargetHeatingCoolingState must be OFF, HEAT, COOL or AUTO
  this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;

  this.service = new Service.Thermostat(this.name);
}

Thermostat.prototype = {
  requestWrapper: function(uri, fields, callback) {
    var method = (fields)?'POST':'GET';
    var commonQuery = (uri == 'tstat' && method == 'GET');

    if (this.querying && commonQuery) {
      // we have another query in progress, let's wait until that one finishes
      setTimeout(function(parm) {
        parm.requestWrapper(uri, fields, callback);
      }, 500, this);
    } else if (commonQuery && this.lastUpdate > stamp() - 15) {
      // use existing data if available - speeds up communication significantly
      callback(null, this.lastJson)
    } else {
      if (commonQuery) this.querying = true;
      if (method == 'POST') this.log(JSON.stringify(fields));

      request({
        method: method,
        url: this.apiroute + '/' + uri,
        form: JSON.stringify(fields)
      }, function (error, response, body) {
        this.querying = false;

        if (!error && response.statusCode == 200) {
          var json = JSON.parse(body);

          if (commonQuery) {
            this.lastJson = json;
            this.lastUpdate = stamp();
          }

          callback(null, json)
        } else {
          callback(error, body)
        }
      }.bind(this));
    }
  },

  getCurrentHeatingCoolingState: function(callback) {
    this.log('getCurrentHeatingCoolingState from:', this.apiroute + '/tstat');

    this.requestWrapper('tstat', null, function(error, json) {
      if (error) {
        this.log('getCurrentHeatingCoolingState error: %s', error);
        callback(error);
      } else {
        var tmode = parseInt(json.tmode);
        this.log('tmode is %s', tmode);
        this.service.setCharacteristic(Characteristic.CurrentHeatingCoolingState, tmode);
        callback(null, tmode);
      }
    }.bind(this));
  },

  getTargetHeatingCoolingState: function(callback) {
    this.log('getTargetHeatingCoolingState from:', this.apiroute + '/tstat');

    this.requestWrapper('tstat', null, function(error, json) {
      if (error) {
        this.log('getTargetHeatingCoolingState error: %s', error);
        callback(error);
      } else {
        this.log('TargetHeatingCoolingState received is %s', json.ttarget, json.tstate);
        this.targetHeatingCoolingState = json.ttarget !== undefined ? json.ttarget : json.tstate;
        this.targetHeatingCoolingState = parseInt(this.targetHeatingCoolingState);
        this.log('TargetHeatingCoolingState is now %s', this.targetHeatingCoolingState);
        callback(null, this.targetHeatingCoolingState);
      }
    }.bind(this));
  },

  setTargetHeatingCoolingState: function(value, callback) {
    this.log('setTargetHeatingCoolingState from/to:', this.targetHeatingCoolingState, value);

    value = parseInt(value);
    this.requestWrapper('tstat', {tmode: value}, function(error, json) {
      if (error) {
        this.log('setTargetHeatingCoolingState error: %s', error);
        callback(error);
      } else {
        this.targetHeatingCoolingState = value;
        callback(null);
      }
    }.bind(this));
  },

  getCurrentRelativeHumidity: function(callback) {
    this.log('getCurrentRelativeHumidity from:', this.apiroute + '/tstat/humidity');

    this.requestWrapper('tstat/humidity', null, function(error, json) {
      if (error) {
        this.log('getCurrentRelativeHumidity error: %s', error);
        callback(error);
      } else {
        this.currentRelativeHumidity = json.humidity;
        this.log('CurrentRelativeHumidity %s', this.currentRelativeHumidity);
        callback(null, this.currentRelativeHumidity);
      }
    }.bind(this));
  },

  getCurrentTemperature: function(callback) {
    this.log('getCurrentTemperature from:', this.apiroute + '/tstat');

    this.requestWrapper('tstat', null, function(error, json) {
      if (error) {
        this.log('getCurrentTemperature error: %s', error);
        callback(error);
      } else {
        this.currentTemperature = fahrenheitToCelsius(parseFloat(json.temp));
        this.log('CurrentTemperature %s', this.currentTemperature);
        callback(null, this.currentTemperature);
      }
    }.bind(this));
  },

  getTargetTemperature: function(callback) {
    this.log('getTargetTemperature from:', this.apiroute + '/tstat');

    this.requestWrapper('tstat', null, function(error, json) {
      if (error) {
        this.log('getTargetTemperature error: %s', error);
        callback(error);
      } else {
        if (json.tmode == 1) { // ttarget
          this.targetTemperature = fahrenheitToCelsius(parseFloat(json.t_heat));
        } else if (json.tmode == 2) {
          this.targetTemperature = fahrenheitToCelsius(parseFloat(json.t_cool));
        } else {
          // thermostat does not give target temperature when off, use current temperature instead
          this.targetTemperature = this.currentTemperature;
        }

        this.log('Target temperature is %s', this.targetTemperature);
        callback(null, this.targetTemperature);
      }
    }.bind(this));
  },

  setTargetTemperature: function(value, callback) {
    this.log('setTargetTemperature from:', this.apiroute + '/tstat');

    value = parseInt(celsiusToFahrenheit(value));

    var fields = {};
//    if (this.targetHeatingCoolingState == 1) {
//      fields['t_heat'] = value;
//    } else if (this.targetHeatingCoolingState == 2) {
//      fields['t_cool'] = value;
//    } else {
      fields['it_heat'] = value;
      fields['it_cool'] = value;
//    }

    this.requestWrapper('tstat', fields, function(error, json) {
      if (error) {
        this.log('setTargetTemperature error: %s', err);
        callback(err);
      } else {
        callback(null);
      }
    }.bind(this));
  },

  getTemperatureDisplayUnits: function(callback) {
    this.log('getTemperatureDisplayUnits:', this.currentTemperatureeratureDisplayUnits);
    callback(null, this.currentTemperatureeratureDisplayUnits);
  },

  setTemperatureDisplayUnits: function(value, callback) {
    this.log('setTemperatureDisplayUnits from %s to %s', this.currentTemperatureeratureDisplayUnits, value);
    this.currentTemperatureeratureDisplayUnits = value;
    callback(null);
  },

  getCoolingThresholdTemperature: function(callback) {
    this.log("getCoolingThresholdTemperature: ", this.coolingThresholdTemperature);
    callback(null, this.coolingThresholdTemperature);
  },

  getHeatingThresholdTemperature: function(callback) {
    this.log("getHeatingThresholdTemperature :" , this.heatingThresholdTemperature);
    callback(null, this.heatingThresholdTemperature);
  },

  getName: function(callback) {
    this.log("getName :", this.name);
    callback(null, this.name);
  },

  getServices: function() {
    // you can OPTIONALLY create an information service if you wish to override the default values for things like serial number, model, etc.
    var informationService = new Service.AccessoryInformation();
    informationService.setCharacteristic(Characteristic.Manufacturer, "HTTP Manufacturer").setCharacteristic(Characteristic.Model, "HTTP Model").setCharacteristic(Characteristic.SerialNumber, "HTTP Serial Number");

    // required characteristics
    this.service.getCharacteristic(Characteristic.CurrentHeatingCoolingState) .on('get', this.getCurrentHeatingCoolingState.bind(this));
    this.service.getCharacteristic(Characteristic.TargetHeatingCoolingState)  .on('get', this.getTargetHeatingCoolingState.bind(this))   .on('set', this.setTargetHeatingCoolingState.bind(this));
    this.service.getCharacteristic(Characteristic.CurrentTemperature)         .on('get', this.getCurrentTemperature.bind(this));
    this.service.getCharacteristic(Characteristic.TargetTemperature)          .on('get', this.getTargetTemperature.bind(this))           .on('set', this.setTargetTemperature.bind(this));
    this.service.getCharacteristic(Characteristic.CurrentRelativeHumidity)    .on('get', this.getCurrentRelativeHumidity.bind(this));
    this.service.getCharacteristic(Characteristic.TemperatureDisplayUnits)    .on('get', this.getTemperatureDisplayUnits.bind(this))     .on('set', this.setTemperatureDisplayUnits.bind(this));

    // optional
    //this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature).on('get', this.getCoolingThresholdTemperature.bind(this));
    //this.service.getCharacteristic(Characteristic.HeatingThresholdTemperature).on('get', this.getHeatingThresholdTemperature.bind(this));

    this.service.getCharacteristic(Characteristic.Name).on('get', this.getName.bind(this));
    this.service.getCharacteristic(Characteristic.CurrentTemperature).setProps({ minValue: this.minTemp, maxValue: this.maxTemp, minStep: 1 });
    this.service.getCharacteristic(Characteristic.TargetTemperature).setProps({ minValue: this.minTemp, maxValue: this.maxTemp, minStep: 1 });

    return [informationService, this.service];
  }
};
