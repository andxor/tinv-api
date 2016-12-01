/*!
 * node FatturaPA API wrapper
 * (c) 2016 Lapo Luchini <l.luchini@andxor.it>
 */
/*jshint node: true, strict: true, globalstrict: true, esversion: 6, varstmt: true, indent: 4, immed: true, undef: true, sub: true, newcap: false */
'use strict';

const
    util = require('util'),
    Bluebird = require('bluebird'),
    req = require('superagent'),
    x2js = new (require('x2js'))();

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
    service: function(data, endpoint, action) {
        const
            pasv = (endpoint == 'P'),
            path = this.root + (pasv ? 'invoicePassive' : 'invoiceReceiver'),
            soap = '"http://www.fatturapa.it/Gateway' + (pasv ? 'FatturePassive/' : 'InviaFatture/') + action + '"',
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
    list: function () {
        let data = {
            'F:Filter': {
                '_xmlns:F': 'http://www.andxor.com/fatturapa/wsdl',
                'Autenticazione': this.auth,
            },
        };
        return this.service(data, 'A', 'ElencoFatture'
        ).then(function (result) {
            let f = result.body.Fatture;
            if (!f.Fattura) // no value
                return [];
            if (Array.isArray(f.Fattura))
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
        return this.service(data, 'P', 'ElencoFatture'
        ).then(function (result) {
            let f = result.body.PasvFatture;
            if (!f.Fattura) // no value
                return [];
            if (Array.isArray(f.Fattura))
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
        return this.service(data, 'A', 'InviaFattura'
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
        return this.service(data, 'A', 'CambiaPassword'
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
        return this.service(data, 'A', 'ImpostaFirma'
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
        return this.service(data, 'P', 'NotificaFE'
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
        return this.service(data, 'A', 'AttNotificaFE'
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
        return this.service(data, 'A', 'Download'
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
        return this.service(data, 'P', 'Download'
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
        return this.service(data, 'A', 'DownloadZip'
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
        return this.service(data, 'P', 'DownloadZip'
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
        return this.service(data, 'P', 'Accept'
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
        return this.service(data, 'P', 'Store'
        ).then(function (result) {
            console.log(result);
            return result.body.Stored;
        });
    }
};

module.exports = FatturaPA;
