<p align="center">
<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">
</p>

# homebridge-sma-inverter
Homebridge plugin to display readings from ModBus enabled SMA Solar Inverters.

# Installation
1. Install Homebridge via these [instructions](https://github.com/homebridge/homebridge/wiki/Install-Homebridge-on-Raspbian).
2. Install `homebridge-sma-inverter` plug-in via the Homebridge UI 'plugins' tab search function or via the following command:
```shell
sudo npm install -g homebridge-sma-inverter
```
3. Update your configuration file. There are two methods using Homebridge UI:
   1. Find `homebridge-sma-inverter` on the 'Plugins' tab, click `SETTINGS` and fill out the pop-up.
   2. Copy and paste the following into your `config.json` via the 'Config' tab:
   ```json
        {
            "name": "SMA Inverter",
            "hostname": "192.168.0.32",
            "refreshInterval": 1,
            "accessory": "SMAInverter"
        }
   ```

# Credit
1. [codyc1515](https://github.com/codyc1515) for the creation and development of the plug-in.
2. [tritter](https://github.com/tritter) for updating dependencies.
3. [mitch7391](https://github.com/mitch7391) for creating a README.

# License
This plugin is distributed under the MIT license. See [LICENSE](https://github.com/codyc1515/homebridge-sma-inverter/blob/master/LICENSE) for details.
