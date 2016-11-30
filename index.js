/*!
 * node FatturaPA API wrapper
 * (c) 2016 Lapo Luchini <l.luchini@andxor.it>
 */
/*jshint node: true, strict: true, globalstrict: true, esversion: 6, varstmt: true, indent: 4, immed: true, undef: true, sub: true, newcap: false */
'use strict';

const
    util = require('util'),
    Q = require('bluebird'),
    req = require('superagent'),
    x2js = new (require('x2js'))();

Q.config({
    warnings: true,
    longStackTraces: true,
    cancellation: false,
    monitoring: false,
});

function FatturaPA(address, cedente, password) {
    this.root = address;
    this.auth = {
        'Cedente': {
            'IdPaese': 'IT',
            'IdCodice': cedente,
        },
        'Password': password,
    };
}

FatturaPA.prototype = {
    js2xml: function (js) {
        return x2js.js2xml(js);
    },
    xml2js: function (xml) {
        return x2js.xml2js(xml);
    },
    service: function(data, endpoint, action) {
        let xml = x2js.js2xml({
            'S:Envelope': {
                '_xmlns:S': 'http://schemas.xmlsoap.org/soap/envelope/',
                'S:Body': data,
            },
        });
        //console.log(xml);
        return Q.resolve(req
            .post(this.root + endpoint)
            .send(xml)
            .set('Content-Type', 'text/xml')
            .set('SOAPAction', action)
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
    list: function () {
        let data = {
            'F:Filter': {
                '_xmlns:F': 'http://www.andxor.com/fatturapa/wsdl',
                'Autenticazione': this.auth,
            },
        };
        return this.service(data, 'invoiceReceiver', '"http://www.fatturapa.it/GatewayInviaFatture/ElencoFatture"'
        ).then(function (result) {
            let f = result.body.Fatture;
            if (!f.Fattura) // no value
                return [];
            if (f.Fattura.length) // arrays of values
                return f.Fattura;
            return [f.Fattura]; // single value
        }).then(function (array) {
            array.forEach(function (f) {
                f.Privati = (f.Privati === 'true');
            });
            return array;
        });
    },
    listPassive: function (arch, inizio, fine) {
        let data =  {
            '_xmlns:F': 'http://www.andxor.com/fatturapa/passive/wsdl',
            'Autenticazione': this.auth,
            'IncludiArchiviate': arch ? 'true' : 'false',
        };
        if (inizio) data.DataInizio = inizio.substr(0, 10);
        if (fine)   data.DataFine   = fine.substr(0, 10);
        data = {'F:PasvFilter': data};
        return this.service(data, 'invoicePassive', '"http://www.fatturapa.it/GatewayFatturePassive/ElencoFatture"'
        ).then(function (result) {
            let f = result.body.PasvFatture;
            if (!f.Fattura) // no value
                return [];
            if (f.Fattura.length) // arrays of values
                return f.Fattura;
            return [f.Fattura]; // single value
        }).then(function (array) {
            array.forEach(function (f) {
                f.DataFattura = f.DataFattura.substr(0, 10);
                f.Privati = (f.Privati === 'true');
            });
            return array;
        });
    },
    send: function (destinatario, committente, body) {
        let data = {
            '_xmlns:F': 'http://www.andxor.com/fatturapa/wsdl',
            'Autenticazione': this.auth,
        };
        if (destinatario.indexOf('@') < 0)
            data.CodiceDestinatario = destinatario;
        else
            data.PECDestinatario = destinatario;
        data.CessionarioCommittente = committente;
        data.FatturaElettronicaBody = body;
        data = { 'F:Fattura': data };
        console.log('Sending:', data);
        return this.service(data, 'invoiceReceiver', '"http://www.fatturapa.it/GatewayInviaFatture/InviaFattura"'
        ).then(function (result) {
            return result.body.ProgressivoInvio.toString();
        });
    },
    changePassword: function (newpassw) {
        let data = {
            'F:CambioPassword': {
                '_xmlns:F': 'http://www.andxor.com/fatturapa/wsdl',
                'Autenticazione': this.auth,
                'NuovaPassword': newpassw,
            },
        };
        return this.service(data, 'invoiceReceiver', '"http://www.fatturapa.it/GatewayInviaFatture/CambiaPassword"'
        ).then(function (result) {
            return result.body.PasswordCambiata.toString() === 'true';
        });
    },
    setSignature: function (alias, newpassw) {
        let data = {
            'F:ImpostaFirma': {
                '_xmlns:F': 'http://www.andxor.com/fatturapa/wsdl',
                'Autenticazione': this.auth,
                'Alias': alias,
                'Password': newpassw,
            },
        };
        return this.service(data, 'invoiceReceiver', '"http://www.fatturapa.it/GatewayInviaFatture/ImpostaFirma"'
        ).then(function (result) {
            return result.body.FirmaImpostata;
        });
    },
    notifyFE: function (identificativoSdI) {
        let data = {
            'F:PasvNotifyFE': {
                '_xmlns:F': 'http://www.andxor.com/fatturapa/passive/wsdl',
                'Autenticazione': this.auth,
                'IdentificativoSdI': identificativoSdI,
            },
        };
        return this.service(data, 'invoicePassive', '"http://www.fatturapa.it/GatewayFatturePassive/NotificaFE"'
        ).then(function (result) {
            console.log(result);
            return result.body.Notifier;
        });
    },
    AttnotifyFE: function (identificativoSdI) {
        let data = {
            'F:NotifyFE': {
                '_xmlns:F': 'http://www.andxor.com/fatturapa/wsdl',
                'Autenticazione': this.auth,
                'IdentificativoSdI': identificativoSdI,
            },
        };
        return this.service(data, 'invoiceReceiver', '"http://www.fatturapa.it/GatewayInviaFatture/AttNotificaFE"'
        ).then(function (result) {
            console.log(result);
            return result.body.AttNotifier;
        });
    },
    download: function(progressivoInvio, progressivoRicezione) {
        let data = {
            'F:Query': {
                '_xmlns:F': 'http://www.andxor.com/fatturapa/wsdl',
                'Autenticazione': this.auth,
                'ProgressivoInvio': progressivoInvio,
                'ProgressivoRicezione': progressivoRicezione,
            },
        };
        return this.service(data, 'invoiceReceiver', '"http://www.fatturapa.it/GatewayInviaFatture/Download"'
        ).then(function (result) {
            return result.body.XML;
        });
    },
    pasvDownload: function(IdentificativoSdI, posizione, unwrap) {
        let data = {
            'F:PasvQuery': {
                '_xmlns:F': 'http://www.andxor.com/fatturapa/passive/wsdl',
                'Autenticazione': this.auth,
                'IdentificativoSdI': IdentificativoSdI,
                'Posizione': posizione,
                'Unwrap': unwrap ? 'true' : 'false',
            },
        };
        if (!posizione)
            delete data['F:PasvQuery'].Posizione;
        return this.service(data, 'invoicePassive', '"http://www.fatturapa.it/GatewayFatturePassive/Download"'
        ).then(function (result) {
            return result.body.PasvXML;
        });
    },
    downloadZip: function(progressivoInvio) {
        let data = {
            'F:ZipQuery': {
                '_xmlns:F': 'http://www.andxor.com/fatturapa/wsdl',
                'Autenticazione': this.auth,
                'ProgressivoInvio': progressivoInvio,
            },
        };
        return this.service(data, 'invoiceReceiver', '"http://www.fatturapa.it/GatewayInviaFatture/DownloadZip"'
        ).then(function (result) {
            return result.body.ZIP;
        });
    },
    pasvDownloadZip: function(IdentificativoSdI) {
        let data = {
            'F:PasvZipQuery': {
                '_xmlns:F': 'http://www.andxor.com/fatturapa/passive/wsdl',
                'Autenticazione': this.auth,
                'IdentificativoSdI': IdentificativoSdI,
            },
        };
        return this.service(data, 'invoicePassive', '"http://www.fatturapa.it/GatewayFatturePassive/DownloadZip"'
        ).then(function (result) {
            return result.body.PasvZIP;
        });
    },
    accept: function (identificativoSdI, accepted, description) {
        let data = {
            'F:Accept': {
                '_xmlns:F': 'http://www.andxor.com/fatturapa/passive/wsdl',
                'Autenticazione': this.auth,
                'IdentificativoSdI': identificativoSdI,
                'Accepted': accepted,
                'Description': description,
            },
        };
        return this.service(data, 'invoicePassive', '"http://www.fatturapa.it/GatewayFatturePassive/Accept"'
        ).then(function (result) {
            console.log('Dati Passati: ' + result.status);
            console.log(result);
            return result.body.Accepted;
        });
    },
    store: function (identificativoSdI) {
        let data = {
            'F:Store': {
                '_xmlns:F': 'http://www.andxor.com/fatturapa/passive/wsdl',
                'Autenticazione': this.auth,
                'IdentificativoSdI': identificativoSdI,
            },
        };
        return this.service(data, 'invoicePassive', '"http://www.fatturapa.it/GatewayFatturePassive/Store"'
        ).then(function (result) {
            console.log(result);
            return result.body.Stored;
        });
    }
};

module.exports = FatturaPA;
