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
    var AGENT_TYPES = ['Android', 'Browser', 'iOS', 'iPad', 'iPhone', 'Mac', 'Mobile', 'webOS', 'Windows'];
    var cache = {};

    function merge(masterAssetData, newAssetData) {

        var assetKeys = Object.keys(newAssetData);
        var i = assetKeys.length;
        var propName;

        while (i--) {
            propName = assetKeys[i];
            var newAssetDataValue = newAssetData[propName];

            if (Array.isArray(newAssetDataValue)) {
                if (masterAssetData[propName]) {
                    masterAssetData[propName] = masterAssetData[propName].concat(newAssetDataValue);
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
//        var i = agentKeys.length;
        var agentType;

        assets.forEach(function(asset) {
            if (typeof asset === 'string') {
                if(filtered[propName]) {
                    filtered[propName].push(asset);
                } else {
                    filtered[propName] = [asset];
                }
            } else if (asset.agents) {
                var i = agentKeys.length;
                while (i--) {
                    agentType = agentKeys[i];
                    if(asset.agents.indexOf(agentType.toLowerCase())>=0 || asset.agents.indexOf(agentType)>=0) {
                        if(filtered[propName]) {
                            filtered[propName].push(asset.name);
                        } else {
                            filtered[propName] = [asset];
                        }
                    }
                }
            }
        });
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
//                case constants.TEMPLATE_FILES:
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

    function _getUserAgentHash(req) {
        var agent = ua(req.headers['user-agent']);

        var hash = '';
        AGENT_TYPES.forEach(function(type) {
            var newVal ='0';
            if(agent[type]) {
                newVal = '1';
            }

            hash = hash + newVal;
        });

        console.log(hash);

        return hash;
    }

    function getModule(req, module) {

        var userAgentHash = _getUserAgentHash(req);
        if(cache[userAgentHash]) {
            return cache[userAgentHash].module;
        } else {
            var mod = filter(req, module);
            cache[userAgentHash] = {module: mod};
            return mod;
        }
    }

    function setModule(req, module) {
        var userAgentHash = _getUserAgentHash(req);
        if(cache[userAgentHash]) {
            cache[userAgentHash].module = module;
        } else {
            cache[userAgentHash] = {module: module};
        }
    }

    function compileSite () {

    }

    module.exports = {
        merge: merge,
        filter: filter,
        getModule: getModule,
        setModule: setModule
    };

})(module);