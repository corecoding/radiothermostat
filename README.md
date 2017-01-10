# homebridge-radiothermostat

Supports Radio Thermostat devices on HomeBridge Platform. It was designed around the CT50. More info at http://www.radiothermostat.com/

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-radiothermostat
3. Update your configuration file. See bellow for a sample.

# Configuration

Configuration sample:

 ```
    {
        "bridge": {
            ...
        },

        "description": "...",

        "accessories": [
            {
                "accessory": "RadioThermostat",
                "name": "Thermostat",
                "apiroute": "http://x.x.x.x",
                "maxTemp": 25,
                "minTemp": 15
            }
        ],

        "platforms":[]
    }
