const WebSocket = require('ws');
const propertiesReader = require('properties-reader');
const api = require('./exchangeAPI.js');

const properties = propertiesReader('config.properties');
const apiKey = properties.get('api.key');
const rate = properties.get('rate');
const cancelRate = properties.get('cancel.rate');

connect(apiKey);

function connect(apiKey) {
  connection = new WebSocket('wss://ws.prod.blockchain.info/mercury-gateway/v1/ws', {
    origin: 'https://exchange.blockchain.com',
  });

  // ON OPEN
  connection.onopen = function () {
    // Subscribe for authentication
    api.subscribeAuth(connection, apiKey);
    // Subscribe to receive symbols in the exchange
    api.subscribeSymbols(connection);
  };

  // Initialising data we need to keep and update according to the messages arriving
  let orders = [];
  let openSymbols = [];
  let symbolMins = {};
  let balances = [];
  let prices = {};
  let l2Bids = {};
  let l2Asks = {};
  // ON MESSAGE
  connection.onmessage = function (evt) {
    const msg = JSON.parse(evt.data);

    // Handling for messages in the auth channel
    if (msg.channel == 'auth') {
      switch (msg.event) {
        case 'subscribed':
          console.log('Websocket authentication successful.');
          api.subscribeTrading(connection);
          api.subscribeBalances(connection);
          break;
        case 'rejected':
          console.log(msg.text);
          break;
        default:
          break;
      }
    }

    // Handling for messages in the symbols channel
    if (msg.channel == 'symbols' && msg.event == 'snapshot') {
      openSymbols = findOpenSymbols(msg);
      symbolMins = findMinsForSymbols(msg.symbols, openSymbols);
    }

    // Handling for messages in the balances channel
    if (msg.channel == 'balances' && msg.event == 'snapshot') {
      balances = msg.balances;
      // We only want to do this once, so check that this is the first balances snapshot arriving
      if (msg.seqnum < 10) {
        // Subscribe for prices and l2 orderbook channels, only for symbols we have available balance in
        positiveBalanceSymbols(balances, openSymbols).forEach((symbol) => {
          console.log('Subscribing to symbol: %s', symbol);
          api.subscribeMarketData(connection, symbol, 60);
          api.subscribeOrdersL2(connection, symbol);
          // Every 10 seconds we run the trading strategy to open and cancel orders
          setInterval(() => botLogic(connection, orders, symbol, balances, l2Bids, l2Asks, prices, symbolMins), 10000);
        });
      }
    }

    // Handling for messages in the prices channel: fill and update the prices per symbol
    if (msg.channel == 'prices' && msg.event != 'subscribed') {
      prices[msg.symbol] = msg.price;
    }

    // Handling for messages in the l2 channel
    if (msg.channel == 'l2') {
      symbol = msg.symbol;
      switch (msg.event) {
        case 'snapshot':
          // Fill l2 data we want to keep with the bids and asks from the snapshot
          l2Bids[symbol] = identifyWithPrice(msg.bids);
          l2Asks[symbol] = identifyWithPrice(msg.asks);
          break;
        case 'updated':
          // Update the bids and asks
          if (msg.bids.length > 0) {
            updateOrDelete(l2Bids[symbol], msg.bids);
          }
          if (msg.asks.length > 0) {
            updateOrDelete(l2Asks[symbol], msg.asks);
          }
          break;
        default:
          break;
      }
    }

    // Handling for messages in the trading channel
    if (msg.channel == 'trading') {
      switch (msg.event) {
        case 'subscribed':
          console.log('Ready to trade!');
          break;
        case 'rejected':
          console.log('Error in trading action: %s.', msg.text);
          break;
        case 'snapshot':
          orders = msg.orders;
          console.log('My orders: %o.', orders);
          break;
        case 'updated':
          userOrdersUpdate(orders, msg);
          console.log('Order %s updated. Status is %s: %s.', msg.orderID, msg.ordStatus, msg.text);
          break;
        default:
          break;
      }
    }

    // Handling for websocket error and closure
    connection.onerror = function (evt) {
      console.log('Error: %o', evt);
    };
    connection.onclose = function () {
      console.log('WebSocket connection closed.');
    };
  };
}

// Contains all the logic for the strategy
// We want to be top of the book, but making sure our price is far enough from the last traded price
// (by at least the rate defined in config.properties)
const botLogic = function (connection, orders, symbol, balances, l2Bids, l2Asks, prices, symbolMins) {
  if (balances.length == 0 || l2Bids[symbol] == undefined || l2Asks == undefined) {
    return;
  }

  // Logic for making limit orders
  bidCurrency = getBidCurrency(symbol);
  bidBalance = getBalanceForCurrency(balances, bidCurrency);
  // Get price of maximum bid
  maximumBid = Object.keys(l2Bids[symbol]).reduce(function (a, b) {
    return Math.max(a, b);
  });
  if (!(bidBalance == undefined || bidBalance <= 0)) {
    if (!isEmptyOrNoKey(prices, symbol)) {
      // latest price * (1 - rate) > price of maximum bid AND latest price is more recent than 3 minutes
      if (prices[symbol][4] * (1 - rate) > maximumBid && timeDifference(prices[symbol][0]) < 180) {
        // Price is maximum bid + smallest possible increment, to be tob
        bidPrice = round(maximumBid + symbolMins[symbol][0], 8);
        // In this case we need to convert the balance to the base currency.
        // We use all balance on the order and correct for the trading fee
        bidQty = roundDown((0.997 * bidBalance) / bidPrice, 6);
        // Check quantity is higher than minimum order size
        if (bidQty > symbolMins[symbol][1]) {
          api.newLimitOrder(connection, symbol, 'GTC', 'buy', bidQty, bidPrice);
          console.log('%d: New bid made on %s at price %d, for quantity %d.', Date.now(), symbol, bidPrice, bidQty);
        }
      }
    }
  }

  askCurrency = getAskCurrency(symbol);
  askBalance = getBalanceForCurrency(balances, askCurrency);
  // Get price of minimum ask
  minimumAsk = Object.keys(l2Asks[symbol]).reduce(function (a, b) {
    return Math.min(a, b);
  });
  if (!(askBalance == undefined || askBalance <= 0)) {
    if (!isEmptyOrNoKey(prices, symbol)) {
      // latest price * (1 + rate) < price of minimum ask AND latest price is more recent than 3 minutes
      if (prices[symbol][4] * (1 + rate) < minimumAsk && timeDifference(prices[symbol][0]) < 180) {
        // Price is minimum ask - increment
        askPrice = round(minimumAsk - symbolMins[symbol][0], 8);
        askQty = askBalance;
        // Check quantity is higher than minimum order size
        if (askQty > symbolMins[symbol][1]) {
          api.newLimitOrder(connection, symbol, 'GTC', 'sell', askBalance, askPrice);
          console.log('%d: New ask made on %s at price %d, for quantity %d.', Date.now(), symbol, askPrice, askQty);
        }
      }
    }
  }

  // Logic for cancelling orders
  orders
    .filter((order) => order.symbol == symbol && (order.ordStatus == 'open' || order.ordStatus == 'partial'))
    .forEach((order) => {
      switch (order.side) {
        case 'buy':
          // Best bid > our price OR latest price * (1 - cancelRate) < our bid price OR last traded price older than 5 mins
          if (
            maximumBid > order.price ||
            prices[symbol][4] * (1 - cancelRate) < order.price ||
            timeDifference(prices[symbol][0]) > 300
          ) {
            api.cancelOrder(order.orderID);
            console.log('%d: Order %s was cancelled. Maximum bid is now %d.', Date.now(), order.orderID, maximumBid);
          }
          break;
        case 'sell':
          // Best ask < our price OR latest price * (1 + cancelRate) > our ask price OR last traded price older than 5 mins
          if (
            minimumAsk < order.price ||
            prices[symbol][4] * (1 + cancelRate) > order.price ||
            timeDifference(prices[symbol][0]) > 300
          ) {
            api.cancelOrder(order.orderID);
            console.log('%d: Order %s was cancelled. Minimum ask is now %d.', Date.now(), order.orderID, minimumAsk);
          }
          break;
        default:
          break;
      }
    });
};

// Transform the array of user orders depending on received updates
const userOrdersUpdate = function (orders, msg) {
  i = orders.findIndex((order) => order.orderID == msg.orderID);
  if (i > -1) {
    if (msg.ordStatus == 'cancelled') {
      orders.splice(i, 1);
    } else {
      orders[i].ordStatus = msg.ordStatus;
    }
  } else {
    orders.push(msg);
  }
};

// Updates l2Bids or l2Asks with data from order book messages
const updateOrDelete = function (orders, newOrders) {
  newOrders.forEach((order) => {
    if (order.num == 0) {
      delete orders[order.px];
    } else {
      orders[order.px] = order;
    }
  });
};

// Assigns the price as a key for each bid or ask
const identifyWithPrice = function (orders) {
  return orders.reduce((obj, order) => {
    return {
      ...obj,
      [order['px']]: order,
    };
  }, {});
};

// Find the balance for a currency in the whole list of user balances
const getBalanceForCurrency = function (balances, currency) {
  const balance = balances.find((balance) => balance.currency == currency);
  if (balance == undefined) {
    return balance;
  } else {
    return balance.available;
  }
};

// Find the symbols where at least one exchanged currency has positive balance
const positiveBalanceSymbols = function (balances, listSymbols) {
  balanceSymbols = [];
  balances
    .filter((balance) => balance.available > 0)
    .forEach((balance) => {
      balanceSymbols = balanceSymbols.concat(
        listSymbols.filter(
          (symbol) => balance.currency == getAskCurrency(symbol) || balance.currency == getBidCurrency(symbol)
        )
      );
    });
  return Array.from(new Set(balanceSymbols));
};

// Returns an array with the open symbols received from the symbols channel
const findOpenSymbols = function (msg) {
  return Object.entries(msg.symbols)
    .map(([key, value]) => {
      if (value.status == 'open') {
        return key;
      }
    })
    .filter((symbol) => {
      return symbol !== undefined;
    });
};

// Gets arrays containing [minimum increment, minimum order size, lot size] for each symbol
const findMinsForSymbols = function (symbols, listSymbols) {
  minsForSymbols = {};
  listSymbols.forEach((symbol) => {
    minsForSymbols[symbol] = [
      round(symbols[symbol].min_price_increment * Math.pow(10, -symbols[symbol].min_price_increment_scale), 8),
      round(symbols[symbol].min_order_size * Math.pow(10, -symbols[symbol].min_order_size_scale), 8),
      round(symbols[symbol].lot_size * Math.pow(10, -symbols[symbol].lot_size_scale), 8),
    ];
  });
  return minsForSymbols;
};

// Get currency after "-" in a symbol
const getBidCurrency = function (symbol) {
  return symbol.substr(symbol.indexOf('-') + 1);
};

// Get currency before "-" in a symbol
const getAskCurrency = function (symbol) {
  return symbol.substr(0, symbol.indexOf('-'));
};

const timeDifference = function (timestamp) {
  return (Date.now() - timestamp) / 1000;
};

const round = function (value, decimals) {
  if (value.toString().includes('e')) {
    return value;
  }
  return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
};

const roundDown = function (value, decimals) {
  return Number(Math.floor(value + 'e' + decimals) + 'e-' + decimals);
};

const isEmptyOrNoKey = function (obj, key) {
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return true;
  } else if (!keys.includes(key)) {
    return true;
  } else {
    return false;
  }
};

module.exports = {
  positiveBalanceSymbols,
  identifyWithPrice,
  updateOrDelete,
  userOrdersUpdate,
  findMinsForSymbols,
  getBidCurrency,
  getAskCurrency,
  getBalanceForCurrency,
  timeDifference,
  isEmptyOrNoKey,
};
