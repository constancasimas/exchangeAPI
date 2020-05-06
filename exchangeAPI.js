granularityArray = [60, 300, 900, 3600, 21600, 86400];
timeInForceArray = ['GTC', 'GTD', 'FOK', 'IOC'];
sideArray = ['buy', 'sell'];

module.exports = {
  // Anonymous subscriptions
  subscribeAuth: function (connection, apiKey) {
    connection.send(
      JSON.stringify({
        token: apiKey,
        action: 'subscribe',
        channel: 'auth',
      })
    );
  },

  subscribeMarketData: function (connection, symbol, granularity) {
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
  },

  subscribeSymbols: function (connection) {
    connection.send(
      JSON.stringify({
        action: 'subscribe',
        channel: 'symbols',
      })
    );
  },

  subscribeOrdersL2: function (connection, symbol) {
    connection.send(
      JSON.stringify({
        action: 'subscribe',
        channel: 'l2',
        symbol: symbol,
      })
    );
  },

  subscribeOrdersL3: function (connection, symbol) {
    connection.send(
      JSON.stringify({
        action: 'subscribe',
        channel: 'l3',
        symbol: symbol,
      })
    );
  },

  // Authenticated subscriptions
  subscribeTrading: function (connection) {
    connection.send(
      JSON.stringify({
        action: 'subscribe',
        channel: 'trading',
      })
    );
  },

  subscribeBalances: function (connection) {
    connection.send(
      JSON.stringify({
        action: 'subscribe',
        channel: 'balances',
      })
    );
  },

  // Trading actions
  newLimitOrder: function (
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
    try {
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
    } catch (error) {
      console.log(error);
    }
  },

  newMarketOrder: function (connection, symbol, side, orderQty, timeInForce = 'GTC', minQty = '') {
    try {
      const marketOrder = {
        ...createSimpleOrder(symbol, timeInForce, side, orderQty),
        ordType: 'market',
        minQty: minQty,
      };
      connection.send(JSON.stringify(marketOrder));
    } catch (error) {
      console.log(error);
    }
  },

  getOrderState: function (orders, orderID) {
    if (orders.length == 0) {
      console.log('There are no open orders.');
      return;
    }
    const order = orders.find((order) => order.orderID === orderID);
    if (!order) {
      console.log('There is no order with this ID %s in the snapshot.', orderID);
      return;
    }
    console.log('State for order %s is %s.', orderID, order.orderState);
  },

  cancelOrder: function (orderID) {
    connection.send(
      JSON.stringify({
        action: 'CancelOrderRequest',
        channel: 'trading',
        orderID: orderID,
      })
    );
  },

  cancelAllOrders: function (orders) {
    if (orders.length == 0) {
      console.log('There are no open orders.');
      return;
    }
    orders.forEach((order) => {
      connection.send(
        JSON.stringify({
          action: 'CancelOrderRequest',
          channel: 'trading',
          orderID: order.orderID,
        })
      );
    });
  },
};

function createSimpleOrder(symbol, timeInForce, side, orderQty) {
  if (!timeInForceArray.includes(timeInForce)) {
    throw `Time in force ${timeInForce} is not valid.`;
  }
  if (!sideArray.includes(side)) {
    throw `Side ${side} is not valid.`;
  }
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
