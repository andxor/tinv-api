'use strict';

const
    tape = require('tape'), // https://github.com/substack/tape
    tapeNock = require('tape-nock'),
    TInv = require('../index'),
    tinv = new TInv('https://tinv-test.andxor.it/', '02233200969', 'password.test'),
    testMode = (process.argv.length > 2 && process.argv[2] == 'local') ? 'lockdown' : 'record',
    test = tapeNock(tape, {
        fixtures: __dirname + '/nock/',
        mode: testMode,
    });

test('active/send', function (t) {
    tinv.send(
        '0000000',
        `<CedentePrestatore>
            <DatiAnagrafici>
                <IdFiscaleIVA>
                    <IdPaese>IT</IdPaese>
                    <IdCodice>02233200969</IdCodice>
                </IdFiscaleIVA>
                <CodiceFiscale>02233200969</CodiceFiscale>
                <Anagrafica>
                    <Denominazione>Andxor Soluzioni Informatiche S.r.l.</Denominazione>
                </Anagrafica>
                <RegimeFiscale>RF17</RegimeFiscale>
            </DatiAnagrafici>
            <Sede>
                <Indirizzo>Via F.lli Gracchi 27</Indirizzo>
                <NumeroCivico>27</NumeroCivico>
                <CAP>20092</CAP>
                <Comune>Cinisello Balsamo</Comune>
                <Provincia>MI</Provincia>
                <Nazione>IT</Nazione>
            </Sede>
            <IscrizioneREA>
                <Ufficio>MI</Ufficio>
                <NumeroREA>1395708</NumeroREA>
                <StatoLiquidazione>LN</StatoLiquidazione>
            </IscrizioneREA>
        </CedentePrestatore>`,
        `<CessionarioCommittente>
            <DatiAnagrafici>
                <IdFiscaleIVA>
                    <IdPaese>IT</IdPaese>
                    <IdCodice>00356680397</IdCodice>
                </IdFiscaleIVA>
                <CodiceFiscale>00356680397</CodiceFiscale>
                <Anagrafica>
                    <Denominazione>PROVINCIA DI RAVENNA LLPP</Denominazione>
                </Anagrafica>
            </DatiAnagrafici>
            <Sede>
                <Indirizzo>P.ZZA DEI CADUTI 2/4</Indirizzo>
                <CAP>48121</CAP>
                <Comune>RAVENNA</Comune>
                <Provincia>RA</Provincia>
                <Nazione>IT</Nazione>
            </Sede>
        </CessionarioCommittente>`,
        `<FatturaElettronicaBody>
            <DatiGenerali>
            <DatiGeneraliDocumento>
                <TipoDocumento>TD01</TipoDocumento>
                <Divisa>EUR</Divisa>
                <Data>2016-01-01</Data>
                <Numero>01</Numero>
                <ImportoTotaleDocumento>12.20</ImportoTotaleDocumento>
                <Causale>Fattura di vendita</Causale>
                <Art73>SI</Art73>
            </DatiGeneraliDocumento>
            </DatiGenerali>
            <DatiBeniServizi>
            <DettaglioLinee>
                <NumeroLinea>1</NumeroLinea>
                <Descrizione>INTERVENTI</Descrizione>
                <Quantita>1.00</Quantita>
                <PrezzoUnitario>10.00</PrezzoUnitario>
                <PrezzoTotale>10.00</PrezzoTotale>
                <AliquotaIVA>22.00</AliquotaIVA>
            </DettaglioLinee>
            <DatiRiepilogo>
                <AliquotaIVA>22.00</AliquotaIVA>
                <ImponibileImporto>10.00</ImponibileImporto>
                <Imposta>2.20</Imposta>
                <EsigibilitaIVA>S</EsigibilitaIVA>
            </DatiRiepilogo>
            </DatiBeniServizi>
            <DatiPagamento>
            <CondizioniPagamento>TP02</CondizioniPagamento>
            <DettaglioPagamento>
                <ModalitaPagamento>MP05</ModalitaPagamento>
                <DataScadenzaPagamento>2016-01-01</DataScadenzaPagamento>
                <ImportoPagamento>12.20</ImportoPagamento>
                <IBAN>IT77B0200000000000000000000</IBAN>
            </DettaglioPagamento>
            </DatiPagamento>
        </FatturaElettronicaBody>`,
        'CedentePrestatore'
    ).then(function (progressivo) {
        t.equal(progressivo.length, 5, 'progressivo is valid');
    }).catch(function (err) {
        t.fail(err.stack);
    }).finally(function () {
        t.end();
    });
});

test('active/list', function (t) {
    const ids = [ '0006N', '0006M', '0006L', '0006K', '0001d', '0000V' ];
    tinv.list(new Date('2010-01-01T00:00Z'), new Date('2018-01-01T00:00Z')
    ).then(function (docs) {
        t.equal(docs.length, ids.length, 'number of documents found');
        t.deepEqual(docs.map(f => f.ProgressivoInvio),
            ids,
            'documents ids');
        const dataPrimo = docs[0].DataOraCreazione;
        t.assert(dataPrimo instanceof Date, 'dates are objects');
        return tinv.list(dataPrimo, dataPrimo);
    }).then(function (docs) {
        t.equal(docs.length, 1, 'date range is inclusive');
        t.equal(docs[0].ProgressivoInvio, ids[0], 'correct document');
        const dataFalsa = 0;
        return tinv.list(dataFalsa, dataFalsa);
    }).then(function (docs) {
        t.equal(docs.length, 0, 'empty value uses array');
    }).catch(function (err) {
        t.fail(err);
    }).finally(function () {
        t.end();
    });
});

test('passive/list', function (t) {
    const ids = [ 11290078642, 11291436023, 544890029, 538612833, 527478060, 524206130, 521703300, 520880036, 511969230, 506210951 ];
    tinv.listPassive(true, new Date('2010-01-01T00:00Z'), new Date('2024-01-18T00:00Z')
    ).then(function (docs) {
        t.equal(docs.length, ids.length, 'number of documents found');
        t.deepEqual(docs.map(f => f.IdentificativoSdI),
            ids,
            'documents ids');
        const dataPrimo = docs[0].DataOraRicezione;
        return tinv.listPassive(true, dataPrimo, dataPrimo);
    }).then(function (docs) {
        t.equal(docs.length, 1, 'date range is inclusive');
        t.equal(docs[0].IdentificativoSdI, ids[0], 'correct document');
        const dataFalsa = 0;
        return tinv.listPassive(true, dataFalsa, dataFalsa);
    }).then(function (docs) {
        t.equal(docs.length, 0, 'empty value uses array');
    }).catch(function (err) {
        t.fail(err);
    }).finally(function () {
        t.end();
    });
});

test('passive/download', function (t) {
    const id = 11290078642;
    tinv.pasvDownload(id, null, true /* unwrap P7S */
    ).then(function (doc) {
        t.equal(doc.length, 6467, 'XML length');
        t.equal(doc.slice(0, 34).toString('ascii'), '<ns2:FatturaElettronica xmlns:ns2=', 'XML value');
        return tinv.pasvDownloadZIP(id);
    }).then(function (doc) {
        t.equal(doc.length, 1972, 'ZIP length');
        t.equal(doc.slice(0, 4).toString('hex'), '504b0304', 'ZIP header');
        return tinv.pasvDownloadPDF(id);
    }).then(function (doc) {
        t.equal(doc.length, 6483, 'PDF length');
        t.equal(doc.slice(0, 10).toString('ascii'), '%PDF-1.5\n%', 'PDF header');
    }).catch(function (err) {
        t.fail(err);
    }).finally(function () {
        t.end();
    });
});
