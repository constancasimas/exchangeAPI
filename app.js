const WebSocket = require('ws');
const propertiesReader = require('properties-reader');
var api = require('./exchangeAPI.js');

const properties = propertiesReader('config.properties');
var apiKey = properties.get('api.key');
connect(apiKey);

function connect(apiKey) {
  connection = new WebSocket('wss://ws.prod.blockchain.info/mercury-gateway/v1/ws', {
    origin: 'https://exchange.blockchain.com',
  });
  connection.onopen = function () {
    api.subscribeAuth(connection, apiKey);
    api.subscribeSymbols(connection);
  };

  connection.onmessage = function (evt) {
    const msg = JSON.parse(evt.data);

    // Authenticate connection
    if (msg.channel == 'auth') {
      switch (msg.event) {
        case 'subscribed':
          console.log('Websocket authentication successful.');
          api.subscribeTrading(connection);
          break;
        case 'rejected':
          console.log(msg.text);
          break;
        default:
          break;
      }
    }

    // Find current open symbols
    let symbols = [];
    let openSymbols = [];
    if (msg.channel == 'symbols' && msg.event == 'snapshot') {
      symbols = api.findSymbols(msg);
      console.log('Symbols: %o', symbols);
      openSymbols = api.findOpenSymbols(msg);
      console.log('Open symbols: %o', openSymbols);

      // Subscribe to order books for open symbols
      if (openSymbols.length > 0) {
        api.subscribeOrdersL2(connection, openSymbols);
        api.subscribeOrdersL3(connection, openSymbols);
      }
    }

    // Get bids and asks for orders channels
    let l2Bids = [];
    let l3Bids = [];
    let l2Asks = [];
    let l3Asks = [];
    if ((msg.channel == 'l2' || 'l3') && msg.event != 'subscribed') {
      if (msg.channel == 'l2') {
        l2Bids = msg.bids;
        l2Asks = msg.asks;
      } else {
        l3Bids = msg.bids;
        l3Asks = msg.asks;
      }
    }

    // Get current orders and start trading
    let orders = [];
    if (msg.channel == 'trading') {
      switch (msg.event) {
        case 'subscribed':
          console.log('Ready to trade!');
          api.newLimitOrder(connection, 'BTC-GBP', 'GTC', 'buy', 0.1, 1.0, 0, '20200501');
          api.newMarketOrder(connection, 'BTC-GBP', 'sell', 0.1);
          api.getOrderState(orders, '2');
          api.cancelOrder('12891851020');
          api.cancelAllOrders(orders);
          break;
        case 'rejected':
          console.log('Error in trading action: %s.', msg.text);
          break;
        case 'snapshot':
          orders = msg.orders;
          break;
        case 'updated':
          console.log('Order %s updated. Status is %s.', msg.orderID, msg.ordStatus);
          break;
        default:
          break;
      }
    }
    connection.onerror = function (evt) {
      console.log('Error: %o', evt);
    };
    connection.onclose = function () {
      console.log('WebSocket connection closed.');
    };
  };
}

function testingOrders() {
  return [
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
  ];
}
