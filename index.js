const inherits = require("util").inherits,
	moment = require('moment'),
	ModbusRTU = require("modbus-serial"),
	dns = require("dns");

var client = new ModbusRTU();

var Service, Characteristic, Accessory, FakeGatoHistoryService;

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	Accessory = homebridge.hap.Accessory;

	FakeGatoHistoryService = require('fakegato-history')(homebridge);

	homebridge.registerAccessory("homebridge-sma-inverter", "SMAInverter", SMAInverter);
};

function SMAInverter(log, config) {
	this.log = log;
	this.hostname = config["hostname"];
	this.refreshInterval = (config['refreshInterval'] * 60000) || 60000;
	this.debug = config["debug"] || false;

	this.value = [];
	this.value.Name = config["name"] || '';
	this.value.Manufacturer = 'SMA Solar Inverters';
	this.value.Model = 'Sunny Boy';
	this.value.FirmwareRevision = '1.0.0';
	this.value.SerialNumber = '123456';

	Characteristic.CustomAmperes = function() {
		Characteristic.call(this, 'Amperes', 'E863F126-079E-48FF-8F27-9C2605A29F52');
		this.setProps({
			format: Characteristic.Formats.FLOAT,
			unit: 'A',
			minValue: 0,
			maxValue: 65535,
			minStep: 0.01,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
		});
		this.value = this.getDefaultValue();
	};
	inherits(Characteristic.CustomAmperes, Characteristic);
	Characteristic.CustomAmperes.UUID = 'E863F126-079E-48FF-8F27-9C2605A29F52';

	Characteristic.CustomKilowattHours = function() {
		Characteristic.call(this, 'Total Consumption', 'E863F10C-079E-48FF-8F27-9C2605A29F52');
		this.setProps({
			format: Characteristic.Formats.FLOAT,
			unit: 'kWh',
			minValue: 0,
			maxValue: 65535,
			minStep: 0.001,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
		});
		this.value = this.getDefaultValue();
	};
	inherits(Characteristic.CustomKilowattHours, Characteristic);
	Characteristic.CustomKilowattHours.UUID = 'E863F10C-079E-48FF-8F27-9C2605A29F52';

	Characteristic.CustomVolts = function() {
		Characteristic.call(this, 'Volts', 'E863F10A-079E-48FF-8F27-9C2605A29F52');
		this.setProps({
			format: Characteristic.Formats.FLOAT,
			unit: 'V',
			minValue: 0,
			maxValue: 65535,
			minStep: 0.1,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
		});
		this.value = this.getDefaultValue();
	};
	inherits(Characteristic.CustomVolts, Characteristic);
	Characteristic.CustomVolts.UUID = 'E863F10A-079E-48FF-8F27-9C2605A29F52';

	Characteristic.CustomWatts = function() {
		Characteristic.call(this, 'Consumption', 'E863F10D-079E-48FF-8F27-9C2605A29F52');
		this.setProps({
			format: Characteristic.Formats.FLOAT,
			unit: 'W',
			minValue: 0,
			maxValue: 65535,
			minStep: 0.1,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
		});
		this.value = this.getDefaultValue();
	};
	inherits(Characteristic.CustomWatts, Characteristic);
	Characteristic.CustomWatts.UUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52';

	// Start the connection and refresh cycles
	this._connect(true);
}

SMAInverter.prototype = {

	identify: function(callback) {
		this.log("identify");
		callback();
	},

	_connect: function(isInitial) {
		if(this.debug) {this.log("Connecting:", this.hostname);}

		// Get the hostname from dns - note: IPv4 support only for now, have not tested IPv6
		try {
			dns.resolve(this.hostname, "A", function (err, addresses, family) {
				// Connect to the ModBus server hostname
				if(!err) {client.connectTCP(addresses[0]);}
				else {client.connectTCP(this.hostname);}
			}.bind(this));
		}
		catch(err) {
			this.log("Failed to resolve DNS hostname - maybe this is an IP address?", err);

			// Connect to the ModBus server IP address
			try {client.connectTCP(this.hostname);}
			catch(err) {this.log("Could not connect using ModBus");}
		}

		try {
			// Set the ModBus Id to use
			client.setID(3);

			if(this.debug) {this.log("Connected");}
		}
		catch(err) {this.log("Could not set the Channel Number");}

		// Set the automatic refresh onload only
		if(isInitial) {
			setInterval(function() {
				this._refresh();
			}.bind(this), this.refreshInterval);
		}

		// Refresh initially once we are connected
		setTimeout(function() {
			this._refresh();
		}.bind(this), 2500);
	},

	_refresh: function() {
		// Obtain the values
		try {
			client.readHoldingRegisters(30051, 10, function(err, data) {
				switch(data.buffer.readUInt32BE()) {
					case "8001": this.value.Manufacturer = "SMA Solar Inverters"; break;
					default: this.value.Manufacturer = "Unknown"; break;
				}
			}.bind(this));

			client.readHoldingRegisters(30053, 10, function(err, data) {
				switch(data.buffer.readUInt32BE()) {
					case "9319" : this.value.Model = "Sunny Boy 3.0"; break;
					case "9320" : this.value.Model = "Sunny Boy 3.6"; break;
					case "9321" : this.value.Model = "Sunny Boy 4.0"; break;
					case "9322" : this.value.Model = "Sunny Boy 5.0"; break;
					default: this.value.Model = "Unknown"; break;
				}
			}.bind(this));

			client.readHoldingRegisters(30057, 10, function(err, data) {this.value.SerialNumber = data.buffer.readUInt32BE();}.bind(this));

			client.readHoldingRegisters(30775, 10, function(err, data) {
				// Check if the value is unrealistic (the inverter is not generating)
				if(data.buffer.readUInt32BE() > 999999) {
					if(this.debug) {this.log("Updating status", "Active", "Off (value is irregular)");}

					this.SMAInverter.getCharacteristic(Characteristic.On).updateValue(0);
					this.SMAInverter.getCharacteristic(Characteristic.OutletInUse).updateValue(0);
				}
				else {
					this.SMAInverter.getCharacteristic(Characteristic.CustomWatts).updateValue(data.buffer.readUInt32BE());

					this.loggingService.addEntry({time: moment().unix(), power: data.buffer.readUInt32BE()});

					if(data.buffer.readUInt32BE() > 0) {
						if(this.debug) {this.log("Updating status", "Active", "On");}

						this.SMAInverter.getCharacteristic(Characteristic.On).updateValue(1);
						this.SMAInverter.getCharacteristic(Characteristic.OutletInUse).updateValue(1);
					}
					else {
						if(this.debug) {this.log("Updating status", "Active", "Off");}

						this.SMAInverter.getCharacteristic(Characteristic.On).updateValue(0);
						this.SMAInverter.getCharacteristic(Characteristic.OutletInUse).updateValue(0);
					}

					client.readHoldingRegisters(30977, 10, function(err, data) {this.SMAInverter.getCharacteristic(Characteristic.CustomAmperes).updateValue(data.buffer.readUInt32BE() / 1000);}.bind(this));
					client.readHoldingRegisters(30783, 10, function(err, data) {this.SMAInverter.getCharacteristic(Characteristic.CustomVolts).updateValue(data.buffer.readUInt32BE() / 100);}.bind(this));
					client.readHoldingRegisters(30529, 10, function(err, data) {this.SMAInverter.getCharacteristic(Characteristic.CustomKilowattHours).updateValue(data.buffer.readUInt32BE() / 1000);}.bind(this));
				}
			}.bind(this));
		}
		catch(err) {
			this.log("Refresh failed", "Attempting reconnect...", err);

			// Attempt to reconnect
			this._connect();
		}
	},

	getServices: function() {
		this.SMAInverter = new Service.Outlet(this.name);

		this.SMAInverter.getCharacteristic(Characteristic.On)
		.on('get',this._getValue.bind(this, "On"))
		.on('set', this._setValue.bind(this, "On"));

		this.SMAInverter.getCharacteristic(Characteristic.OutletInUse)
		.on('get', this._getValue.bind(this, "OutletInUse"));

		this.SMAInverter.addCharacteristic(Characteristic.CustomAmperes);
		this.SMAInverter.getCharacteristic(Characteristic.CustomAmperes)
		.on('get', this._getValue.bind(this, "CustomAmperes"));

		this.SMAInverter.addCharacteristic(Characteristic.CustomKilowattHours);
		this.SMAInverter.getCharacteristic(Characteristic.CustomKilowattHours)
		.on('get', this._getValue.bind(this, "CustomKilowattHours"));

		this.SMAInverter.addCharacteristic(Characteristic.CustomVolts);
		this.SMAInverter.getCharacteristic(Characteristic.CustomVolts)
		.on('get', this._getValue.bind(this, "CustomVolts"));

		this.SMAInverter.addCharacteristic(Characteristic.CustomWatts);
		this.SMAInverter.getCharacteristic(Characteristic.CustomWatts)
		.on('get', this._getValue.bind(this, "CustomWatts"));

		this.loggingService = new FakeGatoHistoryService("energy", Accessory);

		this.informationService = new Service.AccessoryInformation();
		this.informationService
			.setCharacteristic(Characteristic.Name, this.value.Name)
			.setCharacteristic(Characteristic.Manufacturer, this.value.Manufacturer)
			.setCharacteristic(Characteristic.Model, this.value.Model)
			.setCharacteristic(Characteristic.SerialNumber, this.value.SerialNumber);

		return [this.SMAInverter, this.loggingService, this.informationService];
	},

	_getValue: function(CharacteristicName, callback) {
		if(this.debug) {this.log("GET", CharacteristicName);}
		callback(null);
	},

	_setValue: function(CharacteristicName, value, callback) {
		// This does nothing if the user tries to turn it on / off as we cannot action anything on the device
		if(this.debug) {this.log("SET", CharacteristicName);}
		callback(null, true);
	}

};
