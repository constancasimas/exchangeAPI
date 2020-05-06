# Exchange API

Implementation of requests to the Blockchain exchange API in node.js and creation of a bot to make limit orders based on the prices of the order book.

## Purpose

This bot introduces trades on top of the book when the best existing orders are far enough from last traded price. The idea is to get filled at a price that is far enough from market to make immediate profit on the trade due to the mark-to-market prices of the exchanged assets.

## Prerequisites

- npm installed
- node installed

## Running

- Get the code locally:
  `git clone https://github.com/constancasimas/exchangeAPI.git`
- `cd exchangeAPI`
- `npm install`
- Add you API key to the property `api.key` in `config.properties`
- Choose values between 0 and 1 for variables `rate` and `cancel.rate`, also added to `config.properties`. These parameters represent the minimum distance to last traded price, as a percentage of it, for which we place and do not cancel an order, respectively. Note that `cancel.rate` should be smaller than `rate` to avoid cancelling orders right after placing them.
- `npm start`
