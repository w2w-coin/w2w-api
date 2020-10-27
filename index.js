module.exports = W2W;

const http = require('http');
const https = require('https');

const MAX_MIXIN = 10;
const MIN_MIXIN = 2;
const DEFAULT_UNLOCK_HEIGHT = 0;
const DEFAULT_FEE = 10; // raw X
const DEFAULT_CHARACTER_FEE = 10; // raw X

const err = {
  nonNeg: ' must be a non-negative integer',
  hex: ' must be a hexadecimal string',
  opts: 'opts must be object',
  hex64: ' must be 64-digit hexadecimal string',
  addr: ' must be 98-character string beginning with W2W',
  raw: ' must be a raw amount of W2W (X)',
  trans: ' must be a transfer object { address: 98-character string beginning with W2W, amount: raw amount of W2W (X), message: optional string }',
  arr: ' must be an array',
  str: ' must be a string'
};

function W2W(host, walletRpcPort, daemonRpcPort, timeout) {
  if (!host) throw 'host required';
  const parse = host.match(/^([^:]*):\/\/(.*)$/);
  if (parse[1] === 'http') this.protocol = http;
  else if (parse[1] === 'https') this.protocol = https;
  else throw 'host must begin with http(s)://';
  this.host = parse[2];
  this.walletRpcPort = walletRpcPort;
  this.daemonRpcPort = daemonRpcPort;
  this.timeout = timeout || 5000;
}

// Wallet RPC -- w2w_wallet

function wrpc(that, method, params, resolve, reject) {
  request(that.protocol, that.host, that.walletRpcPort, that.timeout, buildRpc(method, params), '/json_rpc', resolve, reject);
}

W2W.prototype.outputs = function () {
  return new Promise((resolve, reject) => {
    wrpc(this, 'get_outputs', {}, resolve, reject);
  });
};

W2W.prototype.height = function () {
  return new Promise((resolve, reject) => {
    wrpc(this, 'get_height', {}, resolve, reject);
  });
};

W2W.prototype.balance = function () {
  return new Promise((resolve, reject) => {
    wrpc(this, 'getbalance', {}, resolve, reject);
  });
};

W2W.prototype.messages = function (opts) {
  return new Promise((resolve, reject) => {
    if (!isObject(opts)) opts = {};
    else if (!isUndefined(opts.firstTxId) && !isNonNegative(opts.firstTxId)) reject('firstTxId' + err.nonNeg);
    else if (!isUndefined(opts.txLimit) && !isNonNegative(opts.txLimit)) reject('txLimit' + err.nonNeg);
    else {
      obj = {
        first_tx_id: opts.firstTxId,
        tx_limit: opts.txLimit
      };
      wrpc(this, 'get_messages', obj, resolve, reject);
    }
  });
};

W2W.prototype.payments = function (paymentId) { // incoming payments
  return new Promise((resolve, reject) => {
    if (!isHex64String(paymentId)) reject('paymentId' + err.hex64);
    else wrpc(this, 'get_payments', { payment_id: paymentId }, resolve, reject);
  });
};

W2W.prototype.transfers = function () {
  return new Promise((resolve, reject) => {
    wrpc(this, 'get_transfers', {}, resolve, reject);
  });
};

W2W.prototype.store = function () {
  return new Promise((resolve, reject) => {
    wrpc(this, 'store', {}, resolve, reject);
  });
};

W2W.prototype.reset = function () {
  return new Promise((resolve, reject) => {
    wrpc(this, 'reset', {}, resolve, reject);
  });
};

W2W.prototype.optimize = function () {
  return new Promise((resolve, reject) => {
    wrpc(this, 'optimize', {}, resolve, reject);
  });
};

W2W.prototype.send = function (opts) {
  return new Promise((resolve, reject) => {
    if (!isObject(opts)) reject(err.opts);
    else if (isUndefined(opts.transfers) || !arrayTest(opts.transfers, isTransfer)) reject('transfers' + err.arr + ' of transfers each of which' + err.trans);
    else if (!isUndefined(opts.paymentId) && !isHex64String(opts.paymentId)) reject('paymentId' + err.hex64);
    else {
      if (isUndefined(opts.mixIn)) opts.mixIn = MIN_MIXIN;
      if (!(opts.mixIn >= MIN_MIXIN && opts.mixIn <= MAX_MIXIN)) reject(MIN_MIXIN + ' <= mixIn <= ' + MAX_MIXIN);
      else {
        if (isUndefined(opts.unlockHeight)) opts.unlockHeight = DEFAULT_UNLOCK_HEIGHT;
        if (!isNonNegative(opts.unlockHeight)) reject('unlockHeight' + err.nonNeg);
        else {
          if (isUndefined(opts.fee)) {
            opts.fee = DEFAULT_FEE;
            opts.transfers.forEach((transfer) => {
              opts.fee += (!isUndefined(transfer.message) ? transfer.message.length * DEFAULT_CHARACTER_FEE : 0);
            });
          }
          if (!isNonNegative(opts.fee)) reject('fee' + err.raw);
          else {
            const obj = {
              destinations: opts.transfers,
              mixin: opts.mixIn,
              fee: opts.fee,
              unlock_time: opts.unlockHeight,
              payment_id: opts.paymentId
            };
            wrpc(this, 'transfer', obj, resolve, reject);
          }
        }
      }
    }
  });
};

// Wallet RPC -- walletd

W2W.prototype.resetOrReplace = function (viewSecretKey) {
  return new Promise((resolve, reject) => {
    if (!isUndefined(viewSecretKey) && !isHex64String(viewSecretKey)) reject('viewSecretKey' + err.hex64);
    else wrpc(this, 'reset', { viewSecretKey: viewSecretKey }, resolve, reject);
  });
};

W2W.prototype.status = function () {
  return new Promise((resolve, reject) => {
    wrpc(this, 'getStatus', {}, resolve, reject);
  });
};

W2W.prototype.getBalance = function (address) {
  return new Promise((resolve, reject) => {
    if (isUndefined(address) || !isAddress(address)) reject('address' + err.addr);
    else wrpc(this, 'getBalance', { address: address }, resolve, reject);
  });
};

W2W.prototype.createAddress = function () {
  return new Promise((resolve, reject) => {
    wrpc(this, 'createAddress', {}, resolve, reject);
  });
};

W2W.prototype.deleteAddress = function (address) {
  return new Promise((resolve, reject) => {
    if (isUndefined(address) || !isAddress(address)) reject('address' + err.addr);
    wrpc(this, 'deleteAddress', { address: address }, resolve, reject);
  });
};

W2W.prototype.getAddresses = function () {
  return new Promise((resolve, reject) => {
    wrpc(this, 'getAddresses', {}, resolve, reject);
  });
};

W2W.prototype.getViewSecretKey = function () {
  return new Promise((resolve, reject) => {
    wrpc(this, 'getViewKey', {}, resolve, reject);
  });
};

W2W.prototype.getSpendKeys = function (address) {
  return new Promise((resolve, reject) => {
    if (isUndefined(address) || !isAddress(address)) reject('address' + err.addr);
    else wrpc(this, 'getSpendKeys', { address: address }, resolve, reject);
  });
};

W2W.prototype.getBlockHashes = function (firstBlockIndex, blockCount) {
  return new Promise((resolve, reject) => {
    if (isUndefined(firstBlockIndex) || !isNonNegative(firstBlockIndex)) reject('firstBlockIndex' + err.nonNeg);
    else if (isUndefined(blockCount) || !isNonNegative(blockCount)) reject('blockCount' + err.nonNeg);
    else wrpc(this, 'getBlockHashes', { firstBlockIndex: firstBlockIndex, blockCount: blockCount }, resolve, reject);
  });
};

W2W.prototype.getTransaction = function (hash) {
  return new Promise((resolve, reject) => {
    if (!isHex64String(hash)) reject('hash' + err.hex64);
    else wrpc(this, 'getTransaction', { transactionHash: hash }, resolve, reject);
  });
};

W2W.prototype.getUnconfirmedTransactionHashes = function (addresses) {
  return new Promise((resolve, reject) => {
    if (!isUndefined(addresses) && !arrayTest(addresses, isAddress)) reject('addresses' + err.arr + ' of addresses each of which' + err.addr);
    else wrpc(this, 'getUnconfirmedTransactionHashes', { addresses: addresses }, resolve, reject);
  });
};

W2W.prototype.getTransactionHashes = function (opts) {
  return new Promise((resolve, reject) => {
    if (!isObject(opts)) reject(err.opts);
    else if (!isNonNegative(opts.blockCount)) reject('blockCount' + err.nonNeg);
    else if (isUndefined(opts.firstBlockIndex) && isUndefined(opts.blockHash)) reject('either firstBlockIndex or blockHash is required');
    else if (!isUndefined(opts.firstBlockIndex) && !isNonNegative(opts.firstBlockIndex)) reject('firstBlockIndex' + err.nonNeg);
    else if (!isUndefined(opts.blockHash) && !isHex64String(opts.blockHash)) reject('blockHash' + err.hex64);
    else if (!isUndefined(opts.paymentId) && !isHex64String(opts.paymentId)) reject('paymentId' + err.hex64);
    else if (!isUndefined(opts.addresses) && !arrayTest(opts.addresses, isAddress)) reject('addresses' + err.arr + ' of addresses each of which' + err.addr);
    else wrpc(this, 'getTransactionHashes', opts, resolve, reject);
  });
};

W2W.prototype.getTransactions = function (opts) {
  return new Promise((resolve, reject) => {
    if (!isObject(opts)) reject(err.opts);
    else if (!isNonNegative(opts.blockCount)) reject('blockCount' + err.nonNeg);
    else if (isUndefined(opts.firstBlockIndex) && isUndefined(opts.blockHash)) reject('either firstBlockIndex or blockHash is required');
    else if (!isUndefined(opts.firstBlockIndex) && !isNonNegative(opts.firstBlockIndex)) reject('firstBlockIndex' + err.nonNeg);
    else if (!isUndefined(opts.blockHash) && !isHex64String(opts.blockHash)) reject('blockHash' + err.hex64);
    else if (!isUndefined(opts.paymentId) && !isHex64String(opts.paymentId)) reject('paymentId' + err.hex64);
    else if (!isUndefined(opts.addresses) && !arrayTest(opts.addresses, isAddress)) reject('addresses' + err.arr + ' of addresses each of which' + err.addr);
    else wrpc(this, 'getTransactions', opts, resolve, reject);
  });
};

W2W.prototype.sendTransaction = function (opts) {
  return new Promise((resolve, reject) => {
    if (!isObject(opts)) reject(err.opts);
    else if (isUndefined(opts.transfers) || !arrayTest(opts.transfers, isTransfer)) reject('transfers' + err.arr + ' of transfers each of which' + err.trans);
    else if (!isUndefined(opts.addresses) && !arrayTest(opts.addresses, isAddress)) reject('addresses' + err.arr + ' of addresses each of which' + err.addr);
    else if (!isUndefined(opts.changeAddress) && !isAddress(opts.changeAddress)) reject('changeAddress' + err.addr);
    else if (!isUndefined(opts.paymentId) && !isHex64String(opts.paymentId)) reject('paymentId' + err.hex64);
    else if (!isUndefined(opts.extra) && !isString(opts.extra)) reject('extra' + err.str);
    else {
      opts.sourceAddresses = opts.addresses; delete opts.addresses;
      if (isUndefined(opts.mixIn)) opts.mixIn = MIN_MIXIN;
      if (!(opts.mixIn >= MIN_MIXIN && opts.mixIn <= MAX_MIXIN)) reject(MIN_MIXIN + ' <= mixIn <= ' + MAX_MIXIN);
      else {
        opts.anonymity = opts.mixIn; delete opts.mixIn;
        if (isUndefined(opts.unlockHeight)) opts.unlockHeight = DEFAULT_UNLOCK_HEIGHT;
        if (!isNonNegative(opts.unlockHeight)) reject('unlockHeight' + err.nonNeg);
        else {
          opts.unlockTime = opts.unlockHeight; delete opts.unlockHeight;
          if (isUndefined(opts.fee)) {
            opts.fee = DEFAULT_FEE;
            opts.transfers.forEach((transfer) => {
              opts.fee += (!isUndefined(transfer.message) ? transfer.message.length * DEFAULT_CHARACTER_FEE : 0);
            });
          }
          if (!isNonNegative(opts.fee)) reject('fee' + err.raw);
          else wrpc(this, 'sendTransaction', opts, resolve, reject);
        }
      }
    }
  });
};

W2W.prototype.createDelayedTransaction = function (opts) {
  return new Promise((resolve, reject) => {
    if (!isObject(opts)) reject(err.opts);
    else if (isUndefined(opts.transfers) || !arrayTest(opts.transfers, isTransfer)) reject('transfers' + err.arr + ' of transfers each of which' + err.trans);
    else if (!isUndefined(opts.addresses) && !arrayTest(opts.addresses, isAddress)) reject('addresses' + err.arr + ' of addresses each of which' + err.addr);
    else if (!isUndefined(opts.changeAddress) && !isAddress(opts.changeAddress)) reject('changeAddress' + err.addr);
    else if (!isUndefined(opts.paymentId) && !isHex64String(opts.paymentId)) reject('paymentId' + err.hex64);
    else if (!isUndefined(opts.extra) && !isString(opts.extra)) reject('extra' + err.str);
    else {
      if (isUndefined(opts.mixIn)) opts.mixIn = MIN_MIXIN;
      if (!(opts.mixIn >= MIN_MIXIN && opts.mixIn <= MAX_MIXIN)) reject(MIN_MIXIN + ' <= mixIn <= ' + MAX_MIXIN);
      else {
        opts.anonymity = opts.mixIn; delete opts.mixIn;
        if (isUndefined(opts.unlockHeight)) opts.unlockHeight = DEFAULT_UNLOCK_HEIGHT;
        if (!isNonNegative(opts.unlockHeight)) reject('unlockHeight' + err.nonNeg);
        else {
          opts.unlockTime = opts.unlockHeight; delete opts.unlockHeight;
          if (isUndefined(opts.fee)) opts.fee = DEFAULT_FEE * opts.transfers.length;
          if (!isNonNegative(opts.fee)) reject('fee' + err.raw);
          else wrpc(this, 'createDelayedTransaction', opts, resolve, reject);
        }
      }
    }
  });
};

W2W.prototype.getDelayedTransactionHashes = function () {
  return new Promise((resolve, reject) => {
    wrpc(this, 'getDelayedTransactionHashes', {}, resolve, reject);
  });
};

W2W.prototype.deleteDelayedTransaction = function (hash) {
  return new Promise((resolve, reject) => {
    if (!isHex64String(hash)) reject('hash' + err.hex64);
    else wrpc(this, 'deleteDelayedTransaction', { transactionHash: hash }, resolve, reject);
  });
};

W2W.prototype.sendDelayedTransaction = function (hash) {
  return new Promise((resolve, reject) => {
    if (!isHex64String(hash)) reject('hash' + err.hex64);
    else wrpc(this, 'sendDelayedTransaction', { transactionHash: hash }, resolve, reject);
  });
};

W2W.prototype.getMessagesFromExtra = function (extra) {
  return new Promise((resolve, reject) => {
    if (!isHexString(extra)) reject('extra' + err.hex);
    else wrpc(this, 'getMessagesFromExtra', { extra: extra }, resolve, reject);
  });
};

// Daemon RPC - JSON RPC

function drpc(that, method, params, resolve, reject) {
  request(that.protocol, that.host, that.daemonRpcPort, that.timeout, buildRpc(method, params), '/json_rpc', resolve, reject);
}

W2W.prototype.count = function () {
  return new Promise((resolve, reject) => {
    drpc(this, 'getblockcount', {}, resolve, reject);
  });
};

W2W.prototype.blockHashByHeight = function (height) {
  return new Promise((resolve, reject) => {
    if (!isNonNegative(height)) reject('height' + err.nonNeg);
    else drpc(this, 'on_getblockhash', [height], resolve, reject);
  });
};

W2W.prototype.blockHeaderByHash = function (hash) {
  return new Promise((resolve, reject) => {
    if (!isHex64String(hash)) reject('hash' + err.hex64);
    else drpc(this, 'getblockheaderbyhash', { hash: hash }, resolve, reject);
  });
};

W2W.prototype.blockHeaderByHeight = function (height) {
  return new Promise((resolve, reject) => {
    if (!isNonNegative(height)) reject('height' + err.nonNeg);
    else drpc(this, 'getblockheaderbyheight', { height: height }, resolve, reject);
  });
};

W2W.prototype.lastBlockHeader = function () {
  return new Promise((resolve, reject) => {
    drpc(this, 'getlastblockheader', {}, resolve, reject);
  });
};

W2W.prototype.block = function (hash) {
  return new Promise((resolve, reject) => {
    if (!isHex64String(hash)) reject('hash' + err.hex64);
    else drpc(this, 'f_block_json', { hash: hash }, resolve, reject);
  });
};

W2W.prototype.blocks = function (height) {
  return new Promise((resolve, reject) => {
    if (!isNonNegative(height)) reject('height' + err.nonNeg);
    else drpc(this, 'f_blocks_list_json', { height: height }, resolve, reject);
  });
};

W2W.prototype.transaction = function (hash) {
  return new Promise((resolve, reject) => {
    if (!isHex64String(hash)) reject('hash' + err.hex64);
    else drpc(this, 'f_transaction_json', { hash: hash }, resolve, reject);
  });
};

W2W.prototype.transactionPool = function () {
  return new Promise((resolve, reject) => {
    drpc(this, 'f_on_transactions_pool_json', {}, resolve, reject);
  });
};

W2W.prototype.currencyId = function () {
  return new Promise((resolve, reject) => {
    drpc(this, 'getcurrencyid', {}, resolve, reject);
  });
};

W2W.prototype.blockTemplate = function (opts) {
  return new Promise((resolve, reject) => {
    if (!isObject(opts)) reject(err.opts);
    else if (!isAddress(opts.address)) reject('address' + err.addr);
    else if (!isNonNegative(opts.reserveSize) || opts.reserveSize > 255) reject('0 <= reserveSize <= 255');
    else drpc(this, 'getblocktemplate', { wallet_address: opts.address, reserve_size: opts.reserveSize }, resolve, reject);
  });
};

W2W.prototype.submitBlock = function (block) {
  return new Promise((resolve, reject) => {
    if (!isHexString(block)) reject('block' + err.hex);
    else drpc(this, 'submitblock', [block], resolve, reject);
  });
};

// Daemon RPC - JSON handlers

function hrpc(that, params, path, resolve, reject) {
  request(that.protocol, that.host, that.daemonRpcPort, that.timeout, JSON.stringify(params), path, resolve, reject);
}

W2W.prototype.info = function () {
  return new Promise((resolve, reject) => {
    hrpc(this, {}, '/getinfo', resolve, reject);
  });
};

W2W.prototype.index = function () {
  return new Promise((resolve, reject) => {
    hrpc(this, {}, '/getheight', resolve, reject);
  });
};
/*
W2W.prototype.startMining = function (opts) {
  return new Promise((resolve, reject) => {
    if (!isObject(opts)) reject(err.opts)
    else if (!isAddress(opts.address)) reject('address' + err.addr)
    else if (!isNonNegative(opts.threads)) reject('unlockHeight' + err.nonNeg)
    else hrpc(this, { miner_address: opts.address, threads_count: opts.threads }, '/start_mining', resolve, reject)
  })
}

W2W.prototype.stopMining = function () {
  return new Promise((resolve, reject) => {
    hrpc(this, { }, '/stop_mining', resolve, reject)
  })
}
*/
W2W.prototype.transactions = function (txs) {
  return new Promise((resolve, reject) => {
    if (!arrayTest(txs, isHex64String)) reject('txs' + err.arr + ' of transactions each of which ' + err.hex64);
    else hrpc(this, { txs_hashes: txs }, '/gettransactions', resolve, reject);
  });
};

W2W.prototype.sendRawTransaction = function (rawTx) {
  return new Promise((resolve, reject) => {
    if (!isHexString(rawTx)) reject('rawTx' + err.hex);
    else hrpc(this, { tx_as_hex: rawTx }, '/sendrawtransaction', resolve, reject);
  });
};

// Utilities

function arrayTest(arr, test) {
  if (!Array.isArray(arr)) return false;
  let i;
  for (i = 0; i < arr.length; i++) { if (!test(arr[i])) break; }
  if (i < arr.length) return false;
  return true;
}

function isObject(obj) { return typeof obj === 'object'; }

function isUndefined(obj) { return typeof obj === 'undefined'; }

function isString(obj) { return typeof obj === 'string'; }

function isTransfer(obj) {
  if (!isObject(obj) || !isAddress(obj.address) || !isNonNegative(obj.amount)) return false;
  if (typeof obj.message !== 'undefined' && !isString(obj.message)) return false;
  return true;
}

function isNonNegative(n) { return (Number.isInteger(n) && n >= 0); }

function isNumeric(n) { return !isNaN(parseFloat(n)) && isFinite(n); }

function isAddress(str) { return (typeof str === 'string' && str.length === 98 && str.slice(0, 3) === 'W2W'); }

function isHex64String(str) { return (typeof str === 'string' && /^[0-9a-fA-F]{64}$/.test(str)); }

function isHexString(str) { return (typeof str === 'string' && !/[^0-9a-fA-F]/.test(str)); }

function buildRpc(method, params) { return '{"jsonrpc":"2.0","id":"0","method":"' + method + '","params":' + JSON.stringify(params) + '}'; }

function request(protocol, host, port, timeout, post, path, resolve, reject) {
  const obj = {
    hostname: host,
    port: port,
    method: 'POST',
    timeout: timeout,
    path: path,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': post.length,
    }
  };
  var doRequest = protocol.request(
    obj,
    (res) => {
      let data = Buffer.alloc(0);
      res.on('data', (chunk) => { data = Buffer.concat([data, chunk]); });
      res.on('end', () => {
        try {
          data = JSON.parse(data.toString());
          if (data.error) { reject(data.error.message); return; }
        } catch (error) { reject(error.message); return; }
        if (data.result) data = data.result;
        resolve(data);
      });
    }
  );

  doRequest.on('error', (error) => {
    reject('RPC server error');
  });

  doRequest.on('timeout', () => {
    reject("RFC timeout");
    doRequest.abort();
  });

  doRequest.end(post);
}
