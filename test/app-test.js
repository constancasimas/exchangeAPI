var { assert } = require('chai');
var app = require('../app');

describe('positiveBalanceSymbols', function () {
  it('should not include symbols with no available balance', function () {
    const balances = [
      {
        currency: 'BTC',
        balance: 0.00366963,
        available: 0.00266963,
        balance_local: 38.746779155,
        available_local: 28.188009155,
        rate: 10558.77,
      },
      {
        currency: 'USD',
        balance: 11.66,
        available: 0.2,
        balance_local: 11.66,
        available_local: 0.0,
        rate: 1.0,
      },
      {
        currency: 'ETH',
        balance: 0.0,
        available: 0.0,
        balance_local: 37.289855013,
        available_local: 37.289855013,
        rate: 205.84,
      },
    ];

    const openSymbols = ['BTC-USD', 'ETH-BTC', 'ETH-EUR', 'BTC-EUR', 'EUR-GBP', 'ETH-USDT'];
    const result = app.positiveBalanceSymbols(balances, openSymbols);
    assert.include(result, 'BTC-USD');
    assert.include(result, 'BTC-EUR');
    assert.include(result, 'ETH-BTC');
    assert.isFalse(result.includes('ETH-USDT'));
    assert.isFalse(result.includes('EUR-GBP'));
    assert.isFalse(result.includes('ETH-EUR'));
  });

  it('should return an empty list if there are no symbols with available balance', function () {
    const balances = [
      {
        currency: 'BTC',
        balance: 0.0,
        available: 0.0,
        balance_local: 38.746779155,
        available_local: 28.188009155,
        rate: 10558.77,
      },
    ];

    const openSymbols = ['BTC-USD', 'ETH-BTC', 'ETH-EUR', 'BTC-EUR', 'EUR-GBP'];
    const result = app.positiveBalanceSymbols(balances, openSymbols);
    assert.equal(result.length, 0);
  });
});

describe('identifyWithPrice', function () {
  it('should get an array of asks or bids and return the same keyed by price', function () {
    const bids = [
      {
        px: 8723.45,
        qty: 1.45,
        num: 2,
      },
      {
        px: 8124.45,
        qty: 123.45,
        num: 1,
      },
    ];

    bidsResult = app.identifyWithPrice(bids);
    Object.entries(bidsResult).forEach(([key, value]) => {
      assert.equal(value.px, key);
    });
  });

  it('should return an empty object if it receives an empty list', function () {
    const orders = [];
    assert.isEmpty(app.identifyWithPrice(orders));
  });
});

describe('updateOrDelete', function () {
  it('should add orders with new prices', function () {
    const orders = {
      '10': { num: 1, px: 10, qty: 15 },
      '150': { num: 1, px: 150, qty: 1 },
      '1.06': { num: 2, px: 1.06, qty: 44.03 },
    };

    const updates = [
      { num: 1, px: 195.0, qty: 0.56 },
      { num: 1, px: 196.5, qty: 0.56 },
    ];
    app.updateOrDelete(orders, updates);

    assert.equal(Object.keys(orders).length, 5);
    assert.include(
      Object.values(orders).map((value) => value.px),
      195.0
    );
    assert.include(
      Object.values(orders).map((value) => value.px),
      196.5
    );
  });
  it('should update orders with new quantities', function () {
    const orders = {
      '10': { num: 1, px: 10, qty: 15 },
      '150': { num: 1, px: 150, qty: 1 },
      '1.06': { num: 2, px: 1.06, qty: 44.03 },
    };

    const updates = [
      { num: 2, px: 10.0, qty: 1 },
      { num: 3, px: 150.0, qty: 1.05 },
    ];
    app.updateOrDelete(orders, updates);

    assert.equal(Object.keys(orders).length, 3);
    assert.equal(orders['10'].num, 2);
    assert.equal(orders['10'].qty, 1);
    assert.equal(orders['150'].num, 3);
    assert.equal(orders['150'].qty, 1.05);
  });
  it('should remove prices with update to quantity 0', function () {
    const orders = {
      '10': { num: 1, px: 10, qty: 15 },
      '150': { num: 1, px: 150, qty: 1 },
      '1.06': { num: 2, px: 1.06, qty: 44.03 },
    };

    const updates = [{ num: 0, px: 10.0, qty: 0 }];
    app.updateOrDelete(orders, updates);

    assert.equal(Object.keys(orders).length, 2);
    assert.isFalse(Object.keys(orders).includes('10'));
  });
});

describe('userOrdersUpdate', function () {
  it('should manage the users orders by processing the updates', function () {
    const orders = [
      {
        orderID: '12891851020',
        clOrdID: '78502a08-c8f1-4eff-b',
        symbol: 'BTC-USD',
        side: 'sell',
        ordType: 'limit',
        orderQty: 5.0e-4,
        leavesQty: 5.0e-4,
        cumQty: 0.0,
        avgPx: 0.0,
        ordStatus: 'open',
        timeInForce: 'GTC',
        text: 'New order',
        execType: '0',
        execID: '11321871',
        transactTime: '2019-08-13T11:30:03.000593290Z',
        msgType: 8,
        lastPx: 0.0,
        lastShares: 0.0,
        tradeId: '0',
        price: 15000.0,
      },
    ];

    const update1 = {
      seqnum: 3,
      event: 'updated',
      channel: 'trading',
      msgType: '8',
      clOrdID: 'Client ID 3',
      orderID: '999999878',
      ordStatus: 'open',
      execType: '0',
      symbol: 'BTC-USD',
      side: 'sell',
      orderQty: 10.0,
      ordType: 'limit',
      price: 3400.0,
      transactTime: '2019-08-13T13:09:34.000659345Z',
      leavesQty: 10.0,
      cumQty: 0.0,
      avgPx: 0.0,
    };

    const update2 = {
      seqnum: 3,
      event: 'updated',
      channel: 'trading',
      msgType: '8',
      clOrdID: 'Client ID 3',
      orderID: '999999878',
      ordStatus: 'filled',
      execType: '0',
      symbol: 'BTC-USD',
      side: 'sell',
      orderQty: 10.0,
      ordType: 'limit',
      price: 3400.0,
      transactTime: '2019-08-13T13:09:34.000659345Z',
      leavesQty: 10.0,
      cumQty: 0.0,
      avgPx: 0.0,
    };

    const update3 = {
      seqnum: 3,
      event: 'updated',
      channel: 'trading',
      msgType: '8',
      clOrdID: '78502a08-c8f1-4eff-b',
      orderID: '12891851020',
      ordStatus: 'cancelled',
    };

    app.userOrdersUpdate(orders, update1);
    assert.equal(orders.length, 2);

    app.userOrdersUpdate(orders, update2);
    assert.equal(orders.find((order) => order.orderID == '999999878').ordStatus, 'filled');

    app.userOrdersUpdate(orders, update3);
    assert.equal(orders.length, 1);
  });
});

describe('findMinsForSymbols', function () {
  it('should have correct values for min_price_increment * (10^-min_price_increment_scale) and min_order_size*(10^-min_order_size_scale)', function () {
    const symbols = {
      'BTC-USD': {
        base_currency: 'BTC',
        base_currency_scale: 8,
        counter_currency: 'USD',
        counter_currency_scale: 2,
        min_price_increment: 10,
        min_price_increment_scale: 0,
        min_order_size: 50,
        min_order_size_scale: 2,
        max_order_size: 0,
        max_order_size_scale: 8,
        lot_size: 5,
        lot_size_scale: 2,
        status: 'open',
        id: 1,
        auction_price: 0.0,
        auction_size: 0.0,
        auction_time: '',
        imbalance: 0.0,
      },
      'ETH-BTC': {
        base_currency: 'ETH',
        base_currency_scale: 8,
        counter_currency: 'BTC',
        counter_currency_scale: 8,
        min_price_increment: 100,
        min_price_increment_scale: 8,
        min_order_size: 220001,
        min_order_size_scale: 8,
        max_order_size: 0,
        max_order_size_scale: 8,
        lot_size: 0,
        lot_size_scale: 0,
        status: 'open',
        id: 3,
        auction_price: 0.0,
        auction_size: 0.0,
        auction_time: '',
        imbalance: 0.0,
      },
    };

    const openSymbols = ['ETH-BTC', 'BTC-USD'];
    const result = app.findMinsForSymbols(symbols, openSymbols);
    assert.equal(result['BTC-USD'][0], 10);
    assert.equal(result['BTC-USD'][1], 50 * 0.01);
    assert.equal(result['ETH-BTC'][0], 100 * Math.pow(10, -8));
    assert.equal(result['ETH-BTC'][1], 220001 * Math.pow(10, -8));
  });
});

describe('getBidCurrency and getAskCurrency', function () {
  it('should get the currency after - in the symbol', function () {
    assert.equal(app.getBidCurrency('BTC-USD'), 'USD');
    assert.equal(app.getBidCurrency('USD-USDT'), 'USDT');
  });

  it('should get the currency before - in the symbol', function () {
    assert.equal(app.getAskCurrency('BTC-USD'), 'BTC');
    assert.equal(app.getAskCurrency('USDT-BTC'), 'USDT');
  });
});

describe('countDecimals', function () {
  it('should get the number of decimals, or 0 if it is an integer', function () {
    assert.equal(app.countDecimals(0.000052), 6);
    assert.equal(app.countDecimals(93), 0);
    assert.equal(app.countDecimals(7.74), 2);
  });

  it('should give the number of decimals with scientific notation like 1e-n', function () {
    assert.equal(app.countDecimals(1e-8), 8);
  });
});

describe('getBalanceForCurrency', function () {
  it('should get the available balance for a currency', function () {
    const balances = [
      {
        currency: 'BTC',
        balance: 0.00366963,
        available: 0.00266963,
        balance_local: 38.746779155,
        available_local: 28.188009155,
        rate: 10558.77,
      },
      {
        currency: 'USD',
        balance: 11.66,
        available: 0.0,
        balance_local: 11.66,
        available_local: 0.0,
        rate: 1.0,
      },
    ];

    assert.equal(app.getBalanceForCurrency(balances, 'USD'), 0.0);
    assert.equal(app.getBalanceForCurrency(balances, 'BTC'), 0.00266963);
    assert.equal(app.getBalanceForCurrency(balances, 'EUR'), undefined);
  });
});

describe('timeDifference', function () {
  it('should get me the time difference between now and other timestamp in seconds', function () {
    assert.isTrue(app.timeDifference(Date.now() - 60000 * 3) >= 180);
  });
});

describe('new order', function () {
  it('should test the logic for making a new order', function () {
    const rate = 0.02;
    const symbolMins = {
      'BTC-EUR': [0.1, 0.0005],
      'BTC-USD': [0.1, 0.0002],
      'BTC-USD': [0.1, 0.0002],
    };
    const prices = {
      'BTC-EUR': [Date.now() - 60000 * 1, 8188, 8223.1, 8188, 8223.1, 3.9],
      'BTC-USD': [Date.now() - 60000 * 3, 8875, 8875, 8875, 8875, 1.292],
      'GBP-BTC': [Date.now() - 60000 * 2, 8875, 8875, 8875, 8051.0, 1.292],
    };
    let maximumBid = 8050.0;

    assert.isTrue(!app.isEmptyOrNoKey(prices, 'BTC-EUR'));
    assert.isTrue(prices['BTC-EUR'][4] * (1 - rate) > maximumBid && app.timeDifference(prices['BTC-EUR'][0]) < 180);
    assert.equal(8050.1, maximumBid + symbolMins['BTC-EUR'][0]);

    assert.isTrue(!app.isEmptyOrNoKey(prices, 'BTC-USD'));
    assert.isTrue(prices['BTC-USD'][4] * (1 - rate) > maximumBid);
    assert.isFalse(app.timeDifference(prices['BTC-USD'][0]) < 180);
    assert.isFalse(prices['BTC-USD'][4] * (1 - rate) > maximumBid && app.timeDifference(prices['BTC-USD'][0]) < 180);

    assert.isTrue(!app.isEmptyOrNoKey(prices, 'GBP-BTC'));
    assert.isTrue(app.timeDifference(prices['GBP-BTC'][0]) < 180);
    assert.isFalse(prices['GBP-BTC'][4] * (1 - rate) > maximumBid);
    assert.isFalse(prices['GBP-BTC'][4] * (1 - rate) > maximumBid && app.timeDifference(prices['GBP-BTC'][0]) < 180);
  });
});
