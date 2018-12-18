/*!
 * node FatturaPA API wrapper
 * (c) 2016-2018 Lapo Luchini <l.luchini@andxor.it>
 */
'use strict';

const
    Bluebird = require('bluebird'),
    req = require('superagent');

function FatturaPA(address, cedente, password) {
    this.root = address + 'userREST/';
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

function massage(json) {
    for (const k in json) {
        const val = json[k],
            type = typeof val;
        if (type == 'object')
            json[k] = massage(val);
        else if (type == 'number' && k.startsWith('Data'))
            json[k] = new Date(val);
    }
    return json;
}

FatturaPA.prototype = {
    service: function(data, path) {
        if (path == 'A' || path == 'P')
            throw new Error('This method has not been upgraded to new version yet.');
        return FatturaPA.Promise.resolve(req
            .post(this.root + path)
            .send(data)
        ).catch(function (err) {
            if (err.status == 404)
                throw new Error('The configured REST endpoint does not exist.');
            if ('error' in err.response.body)
                throw new Error(err.response.body.error);
            throw new Error('Server error (status=' + err.status + ').');
        }).then(r => r.body);
    },
    list: function (inizio, fine) {
        let data = {
            'Autenticazione': this.auth,
        };
        if (inizio) data.DataInizio = inizio;
        if (fine)   data.DataFine   = fine;
        return this.service(data, 'active/list'
        ).then(f => f.Fattura);
    },
    listPassive: function (arch, inizio, fine) {
        let data =  {
            'Autenticazione': this.auth,
            'IncludiArchiviate': !!arch,
        };
        if (inizio) data.DataInizio = inizio;
        if (fine)   data.DataFine   = fine;
        return this.service(data, 'passive/list'
        ).then(f => f.Fattura);
    },
    send: function (destinatario, committente, body) {
        let data = {
            'Autenticazione': this.auth,
        };
        if (destinatario.indexOf('@') < 0)
            data.CodiceDestinatario = destinatario;
        else
            data.PECDestinatario = destinatario;
        if (typeof committente == 'string')
            data.CessionarioCommittenteStr = committente;
        else
            data.CessionarioCommittente = committente;
        if (typeof body == 'string')
            data.FatturaElettronicaBodyStr = body;
        else
            data.FatturaElettronicaBody = body;
        // console.log('Sending:', data);
        return this.service(data, 'active/send'
        ).then(function (result) {
            return result.body.ProgressivoInvio;
        });
    },
    changePassword: function (newpassw) {
        let data = {
            'Autenticazione': this.auth,
            'NuovaPassword': newpassw,
        };
        return this.service(data, 'A', 'CambiaPassword'
        ).then(function (result) {
            return result.body.PasswordCambiata;
        });
    },
    setSignature: function (alias, newpassw) {
        let data = {
            'Autenticazione': this.auth,
            'Alias': alias,
            'Password': newpassw,
        };
        return this.service(data, 'A', 'ImpostaFirma'
        ).then(function (result) {
            return result.body.FirmaImpostata;
        });
    },
    notifyFE: function (identificativoSdI, posizione) {
        let data = {
            'Autenticazione': this.auth,
            'IdentificativoSdI': identificativoSdI,
            'Posizione': posizione,
        };
        return this.service(data, 'P', 'NotificaFE'
        ).then(function (result) {
            console.log(result);
            return result.body.Notifier;
        });
    },
    AttnotifyFE: function (identificativoSdI) {
        let data = {
            'Autenticazione': this.auth,
            'IdentificativoSdI': identificativoSdI,
        };
        return this.service(data, 'A', 'AttNotificaFE'
        ).then(function (result) {
            console.log(result);
            return result.body.AttNotifier;
        });
    },
    download: function(progressivoInvio, progressivoRicezione, minimal) {
        let data = {
            'Autenticazione': this.auth,
            'ProgressivoInvio': progressivoInvio,
            'ProgressivoRicezione': progressivoRicezione,
        };
        if (minimal)
            data.Minimal = true;
        return this.service(data, 'A', 'Download'
        ).then(function (result) {
            return result.body.XML;
        });
    },
    pasvDownload: function(IdentificativoSdI, posizione, unwrap, minimal) {
        let data = {
            'Autenticazione': this.auth,
            'IdentificativoSdI': IdentificativoSdI,
            'Posizione': posizione,
            'Unwrap': !!unwrap,
        };
        if (!posizione)
            delete data['F:PasvQuery'].Posizione;
        if (minimal)
            data['F:PasvQuery'].Minimal = 'true';
        return this.service(data, 'P', 'Download'
        ).then(function (result) {
            return result.body.PasvXML;
        });
    },
    downloadZip: function(progressivoInvio) {
        let data = {
            'Autenticazione': this.auth,
            'ProgressivoInvio': progressivoInvio,
        };
        return this.service(data, 'A', 'DownloadZip'
        ).then(function (result) {
            return result.body.ZIP;
        });
    },
    pasvDownloadZip: function(IdentificativoSdI) {
        let data = {
            'Autenticazione': this.auth,
            'IdentificativoSdI': IdentificativoSdI,
        };
        return this.service(data, 'P', 'DownloadZip'
        ).then(function (result) {
            return result.body.PasvZIP;
        });
    },
    accept: function (identificativoSdI, accepted, description) {
        let data = {
            'Autenticazione': this.auth,
            'IdentificativoSdI': identificativoSdI,
            'Accepted': accepted,
            'Description': description,
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
            'Autenticazione': this.auth,
            'IdentificativoSdI': identificativoSdI,
        };
        return this.service(data, 'P', 'Store'
        ).then(function (result) {
            console.log(result);
            return result.body.Stored;
        });
    }
};

module.exports = FatturaPA;
