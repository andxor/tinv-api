'use strict';

const
    tape = require('tape'), // https://github.com/substack/tape
    tapeNock = require('tape-nock'),
    TInv = require('../index'),
    tinv = new TInv('http://127.0.0.1/fatturapa/', '12345678900', 'pippo'),
    testMode = (process.argv.length > 2 && process.argv[2] == 'local') ? 'lockdown' : 'record',
    test = tapeNock(tape, {
        fixtures: __dirname + '/nock/',
        mode: testMode,
    });

test('active/list', function (t) {
    tinv.list(new Date('2010-01-01T00:00Z'), new Date('2018-01-01T00:00Z')
    ).then(function (docs) {
        t.equal(docs.length, 6, 'number of documents found');
        t.deepEqual(docs.map(f => f.ProgressivoInvio),
            ['0000k', '0000f', '0000d', '00009', '00006', '00005'],
            'documents ids');
        const dataPrimo = docs[0].DataOraCreazione;
        t.assert(dataPrimo instanceof Date, 'dates are objects');
        return tinv.list(dataPrimo, dataPrimo);
    }).then(function (docs) {
        t.equal(docs.length, 1, 'date range is inclusive');
        t.equal(docs[0].ProgressivoInvio, '0000k', 'correct document');
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
    tinv.listPassive(true, new Date('2010-01-01T00:00Z'), new Date('2018-12-15T00:00Z')
    ).then(function (docs) {
        t.equal(docs.length, 5, 'number of documents found');
        t.deepEqual(docs.map(f => f.IdentificativoSdI),
            [9485216, 9485268, 9485342, 9485724, 9491938],
            'documents ids');
        const dataPrimo = docs[0].DataOraRicezione;
        return tinv.listPassive(true, dataPrimo, dataPrimo);
    }).then(function (docs) {
        t.equal(docs.length, 1, 'date range is inclusive');
        t.equal(docs[0].IdentificativoSdI, 9485216, 'correct document');
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
    tinv.pasvDownload(9485216, null, true /* unwrap P7S */
    ).then(function (doc) {
        t.equal(doc.length, 4470, 'XML length');
        t.equal(doc.slice(0, 36).toString('ascii'), '<?xml version="1.0" encoding="UTF-8"', 'XML value');
        return tinv.pasvDownloadZIP(9485216);
    }).then(function (doc) {
        t.equal(doc.length, 2860, 'ZIP length');
        t.equal(doc.slice(0, 4).toString('hex'), '504b0304', 'ZIP header');
        return tinv.pasvDownloadPDF(9485216);
    }).then(function (doc) {
        t.equal(doc.length, 5747, 'PDF length');
        t.equal(doc.slice(0, 10).toString('ascii'), '%PDF-1.5\n%', 'PDF header');
    }).catch(function (err) {
        t.fail(err);
    }).finally(function () {
        t.end();
    });
});
