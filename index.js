/*jslint node: true, vars: true, indent: 4 */
(function (module) {
    "use strict";

    var ua = require('mobile-agent'),
        constants = {
            TRAILING_SCRIPTS: 'trailingScripts',
            STYLESHEETS: 'stylesheets',
            SCRIPTS: 'scripts',
            TEMPLATE_FILES: 'templateFiles'
        },
        AGENT_TYPES = ['Android', 'Browser', 'iOS', 'iPad', 'iPhone', 'Mac', 'Mobile', 'webOS', 'Windows', 'Cordova', 'CordovaDefault', 'Chrome'],
        cache = {
            templates: {},
            files: {}
        },
        HTTP_NOT_FOUND = 404,
        path = require("path"),
        hbars = require("handlebars"),
        util = require("./lib/util"),
        locate = util.locate,
        fs = require("fs"),
        async = require('async');

    function locateSync(dirs, file, idx) {
        var i = idx || 0;

        if (i >= dirs.length) {
            throw new Error("file " + file + " not found in " + dirs);
        }

        var qfile = path.join(dirs[i], file);

        if (fs.existsSync(qfile)) {
            return qfile;
        } else {
            return locateSync(dirs, file, i + 1);
        }
    }

    function merge(masterAssetData, newAssetData) {

        var assetKeys = Object.keys(newAssetData);
        var i = assetKeys.length;
        var propName;

        while (i--) {
            propName = assetKeys[i];
            var newAssetDataValue = newAssetData[propName];

            //console.log('propName: ', propName);

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
            } else if (req.query['agent'] === type) {
                agentTypes.push(req.query['agent']);
                newVal = '1';
            } else if (type === 'Chrome' &&agent.Browser.name == 'chrome' ) {
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

    function getCachedModule(req, namespace) {
        //console.log('getCachedModule: ', namespace);
        if(!namespace) {
            return undefined;
        }
        console.log("originalUrl: " + req.originalUrl);
        var agentInfo = _getUserAgentHash(req);
        var userAgentHash = agentInfo.hash;
        if (namespace) {
            if (namespace && cache[namespace] && cache[namespace][userAgentHash]) {
                return cache[namespace][userAgentHash];
            } else {
                return undefined;
            }
        }
    }

    function getModule(req, module) {
        //console.log('getModule: ');
        //console.log("originalUrl: " + req.originalUrl);
        var agentInfo = _getUserAgentHash(req);
        var userAgentHash = agentInfo.hash;

        if (cache[userAgentHash]) {
            console.log("cached userAgentHash: " + userAgentHash);
            return cache[userAgentHash];
        } else {
            var mod = filter(agentInfo, module);
            cache[userAgentHash] = mod;
            console.log("NOT cached userAgentHash: " + userAgentHash);

            return mod;
        }
    } // 01110010001

    function setModule(req, module, namespace) {
        //console.log('setModule: ', namespace);

        var agentInfo = _getUserAgentHash(req);
        var userAgentHash = agentInfo.hash;
        var mod = filter(agentInfo, module);
        if (namespace) {
            if(!cache[namespace]) {
                cache[namespace] = {};
            }
            if(!cache[namespace][userAgentHash]) {
                cache[namespace][userAgentHash] = mod;
            }
        } else {
            if (cache[userAgentHash]) {
                cache[userAgentHash] = mod;
            } else {
                cache[userAgentHash] = mod;
            }
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
                    return (cb)?cb(err):undefined;
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
        getCachedModule: getCachedModule,
        getModule: getModule,
        setModule: setModule,
        compileSite: compileSite,
        compileHtml: compileHtml,
        locateSync: locateSync
    };

})(module);