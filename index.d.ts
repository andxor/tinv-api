import * as Bluebird from 'bluebird';

export = FatturaPA;

declare class FatturaPA {
    static Promise: Bluebird<any>;

    private root: string;
    private auth: FatturaPA.Auth;

    constructor(address: string, cedente: string, password: string);

    js2xml<T>(js: T): string;

    xml2js<T>(xml: string): T;

    service(data, endpoint, action): Bluebird<{ body: any }>;

    list(): Bluebird<any[]>

    listPassive(arch, inizio, fine): Bluebird<any[]>

    send(destinatario: string, committente: string, body: any): Bluebird<string>

    changePassword(newpassw: string): Bluebird<boolean>

    setSignature(alias: string, newpassw: string): Bluebird<string>

    notifyFE(identificativoSdI: string, posizione: string): Bluebird<string>

    AttnotifyFE(identificativoSdI: string): Bluebird<string>

    download(progressivoInvio: string, progressivoRicezione: string, minimal: boolean): Bluebird<any>

    pasvDownload(IdentificativoSdI: string, posizione: string, unwrap: boolean, minimal: boolean): Bluebird<any>

    downloadZip(progressivoInvio: string): Bluebird<any>

    pasvDownloadZip(progressivoInvio: string): Bluebird<any>

    accept(identificativoSdI: string, accepted: boolean, description: string): Bluebird<boolean>

    store(identificativoSdI: string): Bluebird<any>
}

declare namespace FatturaPA {
    export interface Auth {
        Cedente: {
            IdPaese: string,
            IdCodice: string,
        },
        'Password': string,
    }
}