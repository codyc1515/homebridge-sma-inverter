var request = require("request");
const inherits = require("util").inherits;
var Service, Characteristic;

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	Accessory = homebridge.hap.Accessory;
	
	homebridge.registerAccessory("homebridge-sma-inverter", "SMAInverter", SMAInverter);
};

function SMAInverter(log, config) {
	this.log = log;
	this.hostname = config["hostname"];
	this.username = config["username"];
	this.password = config["password"];
	this.name = config["name"];
	this.sid, this.manufacturer, this.model, this.firmwarerevision, this.serialnumber = "";
	this.debug = config["debug"] || false;
	
	this.value = [];
	this.value.On = false;
	this.value.Amperes = 0;
	this.value.KilowattHours = 0;
	this.value.Volts = 0;
	this.value.Watts = 0;
	
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
}

SMAInverter.prototype = {
	
	identify: function(callback) {
		this.log("identify");
		callback();
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
		
		this.informationService = new Service.AccessoryInformation();
		this.informationService
		.setCharacteristic(Characteristic.Name, "Solar Inverter")
		.setCharacteristic(Characteristic.Manufacturer, "SMA")
		.setCharacteristic(Characteristic.Model, "Sunny Boy")
		.setCharacteristic(Characteristic.SerialNumber, this.hostname);
		
		return [this.informationService, this.SMAInverter];
	},
	
	_getValue: function(CharacteristicName, callback) {
		if(this.debug) {this.log("GET", CharacteristicName);}
		
		// Shows as On if the device is reachable & is generating power
		if(CharacteristicName == "On") {
			// Login to the Inverter
			try {
				request.post({
					url: "http://" + this.hostname + "/dyn/login.json",
					json: {
						right: this.username,
						pass: this.password
					}
				}, function(err, response, body) {
					if (!err && response.statusCode == 200 && typeof body.result.sid !== 'undefined') {
						this.sid = body.result.sid;
					
						// Request all of the Instantaneous Values
						request.post({
							url: "http://" + this.hostname + "/dyn/getAllParamValues.json?sid=" + this.sid,
							json: {
								destDev: []
							}
						}, function(err, response, body) {
							if (!err && response.statusCode == 200) {
								this.name = body["result"]["0156-76BC6948"]["6800_10821E00"][1][0]["val"];
								this.firmwarerevision = "1.0.0"; // body["result"]["0156-76BC6948"]["6800_00823400"][1][0]["val"]
								this.serialnumber = body["result"]["0156-76BC6948"]["6800_00A21E00"][1][0]["val"];
							
								switch(body["result"]["0156-76BC6948"]["6800_08821F00"][1][0]["val"]) {
									case "8001" : this.manufacturer = "SMA Solar Inverters"; break;
									default: this.manufacturer = "Unknown"; break;
								}
								switch(body["result"]["0156-76BC6948"]["6800_08822000"][1][0]["val"]) {
									case "9319" : this.model = "Sunny Boy 3.0"; break;
									case "9320" : this.model = "Sunny Boy 3.6"; break;
									case "9321" : this.model = "Sunny Boy 4.0"; break;
									case "9322" : this.model = "Sunny Boy 5.0"; break;
									default: this.model = "Unknown"; break;
								}
								
								if(this.debug) {
									this.log("Name: " + this.name);
									this.log("Manufacturer: " + this.manufacturer);
									this.log("Model: " + this.model);
									this.log("FirmwareRevision: " + this.firmwarerevision);
									this.log("SerialNumber: " + this.serialnumber);
								}
								
								/*
								this.informationService.getCharacteristic(Characteristic.Name).updateValue(this.name);
								this.informationService.getCharacteristic(Characteristic.Manufacturer).updateValue(this.manufacturer);
								this.informationService.getCharacteristic(Characteristic.Model).updateValue(this.model);
								this.informationService.getCharacteristic(Characteristic.FirmwareRevision).updateValue(this.firmwarerevision);
								this.informationService.getCharacteristic(Characteristic.SerialNumber).updateValue(this.serialnumber);
								*/
								
								// Request all of the Instantaneous Values
								request.post({
									url: "http://" + this.hostname + "/dyn/getAllOnlValues.json?sid=" + this.sid,
									json: {
										destDev: []
									}
								}, function(err, response, body) {
									if (!err && response.statusCode == 200) {
										this.value.Amperes = (body["result"]["0156-76BC6948"]["6380_40452100"][1][0]["val"] / 1000) || 0;
										this.value.KilowattHours = (body["result"]["0156-76BC6948"]["6400_00262200"][1][0]["val"] / 1000) || 0;
										this.value.Volts = (body["result"]["0156-76BC6948"]["6380_40451F00"][1][0]["val"] / 100) || 0;
										this.value.Watts = body["result"]["0156-76BC6948"]["6380_40251E00"][1][0]["val"] || 0;
										
										if(this.debug) {
											this.log("Amperes: " + this.value.Amperes);
											this.log("KilowattHours: " + this.value.KilowattHours);
											this.log("Volts: " + this.value.Volts);
											this.log("Watts: " + this.value.Watts);
										}
										
										this.SMAInverter.getCharacteristic(Characteristic.CustomAmperes).updateValue(this.value.Amperes);
										this.SMAInverter.getCharacteristic(Characteristic.CustomKilowattHours).updateValue(this.value.KilowattHours);
										this.SMAInverter.getCharacteristic(Characteristic.CustomVolts).updateValue(this.value.Volts);
										this.SMAInverter.getCharacteristic(Characteristic.CustomWatts).updateValue(this.value.Watts);
										
										// Logout from the Inverter or we will hit the login limit
										request.post({
											url: "http://" + this.hostname + "/dyn/logout.json?sid=" + this.sid,
											json: {}
										}, function(err, response, body) {
											if (!err && response.statusCode == 200) {
												// Callback to HomeBridge with the result
												if(this.value.Watts > 0) {
													this.value.On = true;
													
													this.SMAInverter.setCharacteristic(Characteristic.On, true);
													this.SMAInverter.setCharacteristic(Characteristic.OutletInUse, true);
													callback(null, true);
												}
												else {
													this.value.On = false;
													
													this.SMAInverter.setCharacteristic(Characteristic.On, false);
													this.SMAInverter.setCharacteristic(Characteristic.OutletInUse, false);
													callback(null, false);
												}
									
											}
											else {this.log("Unable to logout", response.statusCode, err);}
										}.bind(this));
									}
									else {this.log("Unable to get instantaneous values", response.statusCode, err);}
								}.bind(this));
							}
							else {this.log("Unable to get device parameters", response.statusCode, err);}
						}.bind(this));
					}
					else {this.log("Unable to login", response.statusCode, err);}
				}.bind(this));
			}
			catch {
				callback(null, false);
			}
		}
		
		else if(CharacteristicName == "OutletInUse") {callback(null, this.value.On);}
		else if(CharacteristicName == "CustomAmperes") {callback(null, this.value.Amperes);}
		else if(CharacteristicName == "CustomKilowattHours") {callback(null, this.value.KilowattHours);}
		else if(CharacteristicName == "CustomVolts") {callback(null, this.value.Volts);}
		else if(CharacteristicName == "CustomWatts") {callback(null, this.value.Watts);}
		
		else {this.log("Unknown Characteristic called");}
	},
	
	_setValue: function(CharacteristicName, value, callback) {
		// This does nothing if the user tries to turn it on / off as we cannot action anything on the device 
		callback(null, true);
	}
	
};
