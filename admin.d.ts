import * as Bluebird from 'bluebird';

export = FatturaPAAdmin;

declare class FatturaPAAdmin {
    static Promise: Bluebird<any>;

    private root: string;
    private auth: string;

    constructor(address: string, apikey: string);

    js2xml<T>(js: T): string;

    xml2js<T>(xml: string): T;

    service(data: any, action: string): Bluebird<{ body: any }>;
    stats(from: string, to: string): Bluebird<any>;
}

declare namespace FatturaPAAdmin {
    export interface Auth {
        Cedente: {
            IdPaese: string,
            IdCodice: string,
        },
        'Password': string,
    }
}