/*!
 * node FatturaPA API wrapper
 * (c) 2016-2019 Lapo Luchini <l.luchini@andxor.it>
 */
'use strict';

const
    Bluebird = require('bluebird'),
    req = require('superagent'),
    reProto = /^(https?):/,
    reFilename = /filename="?([^"]+)"?/;

function FatturaPA(address, cedente, password, gestione) {
    this.root = address + 'userREST/';
    this.auth = {
        'Cedente': {
            'IdPaese': 'IT',
            'IdCodice': cedente,
        },
        'Password': password,
    };
    if (gestione)
        this.auth.Gestione = {
            'IdPaese': 'IT',
            'IdCodice': gestione,
        };
    const proto = reProto.exec(address);
    if (!proto)
        throw new Error('Unsupported protocol.');
    this.agent = new (require(proto[1])).Agent({
        keepAlive: true, // keep alive connections for reuse
        keepAliveMsecs: 5000, // for up to 5 seconds
        maxSockets: 4, // do not use more than 4 parallel connections
    });
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
        if (type == 'object' && val !== null)
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
            .agent(this.agent)
            .send(data)
        ).catch(function (err) {
            if (err.status == 404)
                throw new Error('The configured REST endpoint does not exist.');
            if ('error' in err.response.body)
                throw new Error(err.response.body.error);
            throw new Error('Server error (status=' + err.status + ').');
        }).then(r => massage(r.body));
    },
    serviceBuf: function(data, path) {
        return FatturaPA.Promise.resolve(req
            .post(this.root + path)
            .agent(this.agent)
            .buffer(true).parse(req.parse.image) // necessary to have resp.body as a Buffer
            .send(data)
        ).catch(function (err) {
            if (err.status == 404)
                throw new Error('The configured REST endpoint does not exist.');
            throw new Error('Server error (status=' + err.status + ').');
        }).then(r => {
            const disp = r.header['content-disposition'];
            if (disp) {
                const m = reFilename.exec(disp);
                if (m)
                    r.body.filename = m[1];
            }
            return r.body;
        });
    },
    list: function (start, end, limit) {
        let data = {
            'Autenticazione': this.auth,
        };
        if (start != null) data.DataOraInizio = start;
        if (end != null)   data.DataOraFine   = end;
        if (limit != null) data.Limite        = limit;
        return this.service(data, 'active/list'
        ).then(f => f.Fattura);
    },
    listPassive: function (arch, start, end, limit) {
        let data =  {
            'Autenticazione': this.auth,
            'IncludiArchiviate': !!arch,
        };
        if (start != null) data.DataOraInizio = start;
        if (end != null)   data.DataOraFine   = end;
        if (limit != null) data.Limite        = limit;
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
            return result.ProgressivoInvio;
        });
    },
    sendCorrispettivo: function (body) {
        let data = {
            'Autenticazione': this.auth,
        };
        data.DatiFatturaBodyDTE = body;
        // console.log('Sending:', data);
        return this.service(data, 'corrispettivi/send'
        ).then(function (result) {
            return result.ProgressivoInvio;
        });
    },
    changePassword: function (newpassw) {
        let data = {
            'Autenticazione': this.auth,
            'NuovaPassword': newpassw,
        };
        return this.service(data, 'A', 'CambiaPassword'
        ).then(function (result) {
            return result.PasswordCambiata;
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
            return result.FirmaImpostata;
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
            return result.Notifier;
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
            return result.AttNotifier;
        });
    },
    download: function(progressivoInvio, progressivoRicezione, minimal) {
        let data = {
            'Autenticazione': this.auth,
            'ProgressivoInvio': progressivoInvio,
        };
        if (progressivoRicezione)
            data.ProgressivoRicezione = progressivoRicezione;
        if (minimal)
            data.Minimal = true;
        return this.serviceBuf(data, 'active/download/file');
    },
    pasvDownload: function(identificativoSdI, posizione, unwrap, minimal) {
        let data = {
            'Autenticazione': this.auth,
            'IdentificativoSdI': identificativoSdI,
        };
        if (posizione)
            data.Posizione = posizione;
        if (unwrap)
            data.Unwrap = true;
        if (minimal)
            data.Minimal = true;
        return this.serviceBuf(data, 'passive/download/file');
    },
    downloadZIP: function(progressivoInvio) {
        let data = {
            'Autenticazione': this.auth,
            'ProgressivoInvio': progressivoInvio,
        };
        return this.serviceBuf(data, 'active/downloadZIP/file');
    },
    pasvDownloadZIP: function(identificativoSdI) {
        let data = {
            'Autenticazione': this.auth,
            'IdentificativoSdI': identificativoSdI,
        };
        return this.serviceBuf(data, 'passive/downloadZIP/file');
    },
    downloadPDF: function(progressivoInvio) {
        let data = {
            'Autenticazione': this.auth,
            'ProgressivoInvio': progressivoInvio,
        };
        return this.serviceBuf(data, 'active/downloadPDF/file');
    },
    pasvDownloadPDF: function(identificativoSdI, posizione) {
        let data = {
            'Autenticazione': this.auth,
            'IdentificativoSdI': identificativoSdI,
        };
        if (posizione)
            data.Posizione = posizione;
        return this.serviceBuf(data, 'passive/downloadPDF/file');
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
            return result.Accepted;
        });
    },
    store: function (identificativoSdI) {
        let data = {
            'Autenticazione': this.auth,
            'IdentificativoSdI': identificativoSdI,
        };
        return this.service(data, 'P', 'Store'
        ).then(function (result) {
            return result.Stored;
        });
    }
};

module.exports = FatturaPA;
