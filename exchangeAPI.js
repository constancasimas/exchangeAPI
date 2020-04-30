const WebSocket = require('ws');

granularityArray = [60, 300, 900, 3600, 21600, 86400];

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

readline.question('Please insert your API key:', (apiKey) => {
  readline.close();
  connect(apiKey);
});

function connect(apiKey) {
  connection = new WebSocket('wss://ws.prod.blockchain.info/mercury-gateway/v1/ws', {
    origin: 'https://exchange.blockchain.com',
  });
  connection.onopen = function () {
    subscriptions(connection, apiKey);
  };

  connection.onmessage = function (evt) {
    var msg = JSON.parse(evt.data);
    if (msg.event != 'subscribed') {
      console.log('Message on %s channel: ', msg.channel);
      console.dir(msg);
    }
    if (msg.channel == 'auth' && msg.event == 'subscribed') {
      console.log('Websocket authentication successful.');
      authSubscriptions(connection);
    }
    if (msg.channel == 'trading' && msg.event == 'subscribed') {
      console.log('Ready to trade!');
      tradingActions(connection, msg);
    }
  };
}

function subscriptions(connection, apiKey) {
  subscribeAuth(connection, apiKey);
  subscribeMarketData(connection, 'BTC-USD', 900);
  subscribeSymbols(connection);
}

function authSubscriptions(connection) {
  subscribeTrading(connection);
  subscribeBalances(connection);
}

function subscribeAuth(connection, apiKey) {
  connection.send(
    JSON.stringify({
      token: apiKey,
      action: 'subscribe',
      channel: 'auth',
    })
  );
}

function subscribeMarketData(connection, symbol, granularity) {
  if (!granularityArray.includes(granularity)) {
    console.log('Granularity %d is incorrect. Unable to subscribe to market data.', granularity);
    return;
  }
  connection.send(
    JSON.stringify({
      action: 'subscribe',
      channel: 'prices',
      symbol: symbol,
      granularity: granularity,
    })
  );
}

function subscribeSymbols(connection) {
  connection.send(
    JSON.stringify({
      action: 'subscribe',
      channel: 'symbols',
    })
  );
}

function subscribeTrading(connection) {
  connection.send(
    JSON.stringify({
      action: 'subscribe',
      channel: 'trading',
    })
  );
}

function subscribeBalances(connection) {
  connection.send(
    JSON.stringify({
      action: 'subscribe',
      channel: 'balances',
    })
  );
}

function tradingActions(connection, msg) {
  newLimitOrder(connection, 'BTC-GBP', 'GTC', 'buy', 0.1, 1.0, 0, '20200501');
  newMarketOrder(connection, 'BTC-GBP', 'sell', 0.1);
  // getOrderState should be getting msg as input, this is just being used for testing
  getOrderState(testingOrders(), '4561237891');
  cancelOrder('12891851020');
  cancelAllOrders(testingOrders());
}

function newLimitOrder(
  connection,
  symbol,
  timeInForce,
  side,
  orderQty,
  price,
  stopPx = 0,
  expireDate = '',
  minQty = '',
  execInst = ''
) {
  const limitOrder = {
    ...createSimpleOrder(symbol, timeInForce, side, orderQty),
    ordType: 'limit',
    price: price,
    stopPx: stopPx,
    expireDate: expireDate,
    minQty: minQty,
    execInst: execInst,
  };
  connection.send(JSON.stringify(limitOrder));
}

function newMarketOrder(connection, symbol, side, orderQty, timeInForce = 'GTC', minQty = '') {
  const marketOrder = {
    ...createSimpleOrder(symbol, timeInForce, side, orderQty),
    ordType: 'market',
    minQty: minQty,
  };
  connection.send(JSON.stringify(marketOrder));
}

function getOrderState(msg, orderID) {
  const state = msg.orders.find((order) => order.orderID === orderID).ordStatus;
  console.log('State for order %s is %s.', orderID, state);
}

function cancelOrder(orderID) {
  connection.send(
    JSON.stringify({
      action: 'CancelOrderRequest',
      channel: 'trading',
      orderID: orderID,
    })
  );
}

function cancelAllOrders(msg) {
  msg.orders.forEach((order) => {
    connection.send(
      JSON.stringify({
        action: 'CancelOrderRequest',
        channel: 'trading',
        orderID: order.orderID,
      })
    );
  });
}

function createSimpleOrder(symbol, timeInForce, side, orderQty) {
  return {
    action: 'NewOrderSingle',
    channel: 'trading',
    clOrdID: 'order' + Math.floor(Math.random() * 100),
    symbol: symbol,
    timeInForce: timeInForce,
    side: side,
    orderQty: orderQty,
  };
}

function testingOrders() {
  return {
    seqnum: 3,
    event: 'snapshot',
    channel: 'trading',
    orders: [
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
      {
        seqnum: 1,
        event: 'updated',
        channel: 'trading',
        orderID: '4561237891',
        clOrdID: 'Client ID 3',
        symbol: 'BTC-USD',
        side: 'buy',
        ordType: 'market',
        orderQty: 3.0,
        leavesQty: 3.0,
        cumQty: 0.0,
        avgPx: 0.0,
        ordStatus: 'cancelled',
        timeInForce: 'GTC',
        text: 'Met cash limit',
        execType: '4',
        execID: '1111111111',
        transactTime: '2019-01-01T08:08:08.000888888Z',
        msgType: 8,
        lastPx: 0.0,
        lastShares: 0.0,
        tradeId: '0',
        fee: 0.0,
      },
    ],
  };
}
