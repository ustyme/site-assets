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
    var cache = {
        templates: {},
        files: {}
    };

    var HTTP_NOT_FOUND = 404,
        path = require("path"),
        hbars = require("handlebars"),
        util = require("./lib/util"),
        locate = util.locate,
        fs = require("fs"),
        async = require('async');

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

                if (typeof newAssetDataValue === 'object') {

                    var newAssetDataValueKeys = Object.keys(newAssetDataValue);
                    var j = newAssetDataValueKeys.length;
                    var prop;

                    while (j--) {
                        prop = newAssetDataValueKeys[j];
                        var newAssetDataObjectValue = newAssetDataValue[prop];

                        if (Array.isArray(newAssetDataObjectValue)) {
                            if (masterAssetData[propName] && masterAssetData[propName][prop]) {
                                masterAssetData[propName][prop] = masterAssetData[propName][prop].concat(newAssetDataObjectValue);
                            } else {
                                masterAssetData[propName][prop] = newAssetDataObjectValue;
                            }
                        } else {
                            masterAssetData[propName][prop] = newAssetDataObjectValue;
                        }
                    }
                } else {
                    masterAssetData[propName] = newAssetDataValue;
                }
            }
        }
    }

    function _filterByAgent(agentInfo, propName, assets, filtered) {
        var agentKeys = agentInfo.agentTypes;
        var agentType;

        assets.forEach(function (asset) {
            if (typeof asset === 'string') {
                if (filtered[propName]) {
                    filtered[propName].push(asset);
                } else {
                    filtered[propName] = [asset];
                }
            } else if (asset.agents) {
                var i = agentKeys.length;
                while (i--) {
                    agentType = agentKeys[i];
                    if (asset.agents.indexOf(agentType.toLowerCase()) >= 0 || asset.agents.indexOf(agentType) >= 0) {
                        if (filtered[propName]) {
                            filtered[propName].push(asset.name);
                        } else {
                            filtered[propName] = [asset];
                        }
                    }
                }
            }
        });
    }

    function filter(agentInfo, defaults) {
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
                    _filterByAgent(agentInfo, propName, propValue, filtered);
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
        var agentTypes = [];

        AGENT_TYPES.forEach(function (type) {
            var newVal = '0';
            if (agent[type]) {
                agentTypes.push(type);
                newVal = '1';
            }

            hash = hash + newVal;
        });

        return {
            hash: hash,
            agentTypes: agentTypes
        };
    }

    function getModule(req, module, namespace) {

        var agentInfo = _getUserAgentHash(req);
        var userAgentHash = agentInfo.hash;
        if (namespace) {
            if (cache[namespace] && cache[namespace][userAgentHash]) {
                return cache[namespace][userAgentHash].module;
            } else if (!module) {
                return undefined;
            } else {
                var mod = filter(agentInfo, module);
                cache[namespace] = {};
                cache[namespace][userAgentHash] = {module: mod};
                return mod;
            }
        } else {
            if (cache[userAgentHash]) {
                return cache[userAgentHash].module;
            } else {
                var mod = filter(agentInfo, module);
                cache[userAgentHash] = {module: mod};
                return mod;
            }
        }

    }

    function setModule(req, module) {
        var agentInfo = _getUserAgentHash(req);
        var userAgentHash = agentInfo.hash;
        if (cache[userAgentHash]) {
            cache[userAgentHash].module = module;
        } else {
            cache[userAgentHash] = {module: module};
        }
    }

    function load(cache, file, cb, debug) {
        if (Object.prototype.toString.call(file) === '[object Function]') {
            return file(cb);
        }

        var cached = cache.files[file];

        if (cached) {
            return cb(undefined, cached);
        }

        fs.readFile(file, "utf-8", function (err, content) {
            if (err) {
                return cb(err);
            }

            cache.files[file] = content;

            return cb(undefined, content);
        });
    }

    function compileHtml(mod, file, statusCode, debug, cb) {
        var cached = cache.templates[file];

        if (cached) {
            return cb(undefined, mod, cached, statusCode);
        }

        return locate(mod["public"], file, function (err, qfile) {
            if (err) {
                if (statusCode === HTTP_NOT_FOUND) {
                    return cb(err);
                }

                return compileHtml(mod, "/404.html", cb, HTTP_NOT_FOUND, debug);
            }
            return load(cache, qfile, function (err, content) {
                if (err) {
                    return cb(err);
                }

                var template = hbars.compile(content);

                cache.templates[file] = template;

                return cb(undefined, mod, template, statusCode);
            }, debug);
        });
    }

    function compileSite(mod, debug, cb) {
        var htmlFiles = mod.htmlFiles,
            rawHtml = [],
            idx = 0,
            templateFiles = mod.templateFiles,
            templateHtml = [],
            file;

        function loadHtmlFiles(cb) {
            var pos = idx++;
            async.each(htmlFiles, function (file, callback) {
                load(cache, file, function (err, content) {
                    if (err) {
                        return callback(err);
                    }

                    rawHtml[pos] = content;
                    return callback();
                }, debug);
            }, cb);
        }

        function loadTemplateFiles(cb) {
            async.each(templateFiles, function (file, callback) {
                var name = path.basename(file, '.html');

                load(cache, file, function (err, content) {
                    if (err) {
                        return callback(err);
                    }

                    templateHtml.push({
                        name: name,
                        content: content
                    });
                    return callback();
                }, debug);
            }, cb);
        }

        if (!mod.compileSite) {
            async.parallel([
                loadHtmlFiles,
                loadTemplateFiles
            ], function (err) {
                if (err) {
                    debug.error(err);
                }
                mod.htmlFiles = rawHtml;
                mod.templateFiles = templateHtml;
                mod.compileSite = true;
                cb();
            });
        } else {
            cb();
        }
    }

    module.exports = {
        merge: merge,
        filter: filter,
        getModule: getModule,
        setModule: setModule,
        compileSite: compileSite,
        compileHtml: compileHtml
    };

})(module);