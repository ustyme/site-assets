/*jslint node: true, vars: true, indent: 4 */
(function (module) {
    "use strict";

    var ua = require('mobile-agent');
    var constants = {
        TRAILING_SCRIPTS: 'trailingScripts',
        STYLESHEETS: 'stylesheets',
        SCRIPTS: 'scripts',
        TEMPLATE_FILES: 'templateFiles'
    };

    function merge(masterAssetData, newAssetData) {

        var assetKeys = Object.keys(newAssetData);
        var i = assetKeys.length;
        var propName;

        while (i--) {
            propName = assetKeys[i];
            var newAssetDataValue = newAssetData[propName];

            if (Array.isArray(newAssetDataValue)) {
                if (masterAssetData[propName]) {

//            console.log("masterAssetData[propName]:" + masterAssetData[propName]);
                    switch (propName) {
                        case constants.TRAILING_SCRIPTS:
                        case constants.STYLESHEETS:
                        case constants.SCRIPTS:
//            case constants.TEMPLATE_FILES:
                            var isNotArray = !Array.isArray(masterAssetData[propName]);
                            if (isNotArray) {
                                masterAssetData[propName].all = masterAssetData[propName].all.concat(newAssetDataValue);
                            } else {
                                masterAssetData[propName] = masterAssetData[propName].concat(newAssetDataValue);
                            }
                            break;
                        default:
                            masterAssetData[propName] = masterAssetData[propName].concat(newAssetDataValue);
                            break;
                    }
                } else {
                    masterAssetData[propName] = newAssetDataValue;
                }

            } else {

//        console.log("masterAssetData[propName]:" + masterAssetData[propName]);
//        console.log('***' + propName);

                if (typeof newAssetDataValue === 'object') {

                    var newAssetDataValueKeys = Object.keys(newAssetDataValue);
                    var j = newAssetDataValueKeys.length;
                    var prop;

                    while (j--) {
                        prop = newAssetDataValueKeys[j];
                        var newAssetDataObjectValue = newAssetDataValue[prop];

                        if (Array.isArray(newAssetDataObjectValue)) {
//              console.log('this is an array');
                            if (masterAssetData[propName] && masterAssetData[propName][prop]) {
                                masterAssetData[propName][prop] = masterAssetData[propName][prop].concat(newAssetDataObjectValue);
                            } else {
                                masterAssetData[propName][prop] = newAssetDataObjectValue;
                            }
                        } else {
//              console.log('just an object');
                            masterAssetData[propName][prop] = newAssetDataObjectValue;
                        }
                    }
                } else {
                    masterAssetData[propName] = newAssetDataValue;
                }
            }
        }
    }

    function _filterByAgent(agent, propName, assets, filtered) {
        agent.all = true;
        var agentKeys = Object.keys(agent);
        var i = agentKeys.length;
        var agentType;

        while (i--) {
            agentType = agentKeys[i];
            if (agent[agentType] && assets[agentType.toLowerCase()]) {
                var lowerAgentType = agentType.toLowerCase();
                if (filtered[propName]) {
                    filtered[propName] = filtered[propName].concat(assets[lowerAgentType]);
                } else {
                    filtered[propName] = assets[lowerAgentType];
                }
            }
        }
    }

    function filter(req, defaults) {

        var agent = ua(req.headers['user-agent']);
        var filtered = {};
        var defaultKeys = Object.keys(defaults);
        var i = defaultKeys.length;
        var propName;
        var propValue;

        while (i--) {
            propName = defaultKeys[i];
            propValue = defaults[propName];
            switch (propName) {
                case constants.TRAILING_SCRIPTS:
                case constants.STYLESHEETS:
                case constants.SCRIPTS:
//        case constants.TEMPLATE_FILES:
//            console.log("prop: " + propName);
                    _filterByAgent(agent, propName, propValue, filtered);
                    break;
                default:
                    filtered[propName] = propValue;
                    break;
            }
        }

        return filtered;

    }

    module.exports = {
        merge: merge,
        filter: filter
    };

})(module);