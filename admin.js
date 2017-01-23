/*!
 * node FatturaPA API wrapper
 * (c) 2016-2017 Lapo Luchini <l.luchini@andxor.it>
 */
/*jshint node: true, strict: true, globalstrict: true, esversion: 6, varstmt: true, indent: 4, immed: true, undef: true, sub: true, newcap: false */
'use strict';

const
    util = require('util'),
    Bluebird = require('bluebird'),
    req = require('superagent'),
    x2js = new (require('x2js'))();

function FatturaPA(address, apikey) {
    this.root = address;
    this.auth = apikey;
}

FatturaPA.Promise = Bluebird.getNewLibraryCopy();

FatturaPA.Promise.config({
    warnings: true,
    longStackTraces: true,
    cancellation: false,
    monitoring: false,
});

FatturaPA.prototype = {
    js2xml: function (js) {
        return x2js.js2xml(js);
    },
    xml2js: function (xml) {
        return x2js.xml2js(xml);
    },
    service: function(data, action) {
        const
            path = this.root + 'adminHandler',
            soap = '"http://www.fatturapa.it/GatewayAdmin/' + action + '"',
            xml = x2js.js2xml({
                'S:Envelope': {
                    '_xmlns:S': 'http://schemas.xmlsoap.org/soap/envelope/',
                    'S:Body': data,
                },
            });
        //console.log(xml);
        return FatturaPA.Promise.resolve(req
            .post(path)
            .send(xml)
            .set('Content-Type', 'text/xml')
            .set('SOAPAction', soap)
        ).catch(function (err) {
            if (err.status == 404)
                throw new Error('The configured WSDL endpoint does not exist.');
            let t;
            try {
                const xml = x2js.xml2js(err.response.text);
                t = new Error(xml.Envelope.Body.Fault.faultstring);
            } catch (e) {
                t = new Error('Server error (status=' + err.status + ').');
            }
            throw t;
        }).then(function (resp) {
            const xml = x2js.xml2js(resp.text);
            return {
                body: xml.Envelope.Body
            };
        });
    },
    stats: function (from, to) {
        let data = {
            'F:StatsReq': {
                '_xmlns:F': 'http://www.andxor.com/fatturapa/admin/wsdl',
                'ApiKey': this.auth,
                'DataInizio': from.substr(0, 10),
                'DataFine': to.substr(0, 10),
            },
        };
        return this.service(data, 'Stats'
        ).then(function (result) {
            return JSON.parse(result.body.Stats.toString());
        });
    }
};

module.exports = FatturaPA;
