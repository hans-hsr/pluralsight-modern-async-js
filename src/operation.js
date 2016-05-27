const delayms = 1;

function getCurrentCity(callback) {
  setTimeout(function () {

    const city = "New York, NY";
    callback(null, city);

  }, delayms)
}

function getWeather(city, callback) {
  console.log("Getting weather");
  setTimeout(function () {

    if (!city) {
      callback(new Error("City required to get weather"));
      return;
    }

    const weather = {
      temp: 50
    };

    callback(null, weather)

  }, delayms)
}

function getForecast(city, callback) {
  console.log("Getting forecast");
  setTimeout(function () {

    if (!city) {
      callback(new Error("City required to get forecast"));
      return;
    }

    const fiveDay = {
      fiveDay: [60, 70, 80, 45, 50]
    };

    callback(null, fiveDay)

  }, delayms)
}

suite.only("operations");

function fetchCurrentCity() {
  const operation = new Operation();

  getCurrentCity(operation.nodeCallback);

  return operation;
}

function fetchForecast(city) {
  const operation = new Operation();

  getForecast(city, operation.nodeCallback);

  return operation;
}

function fetchWeather(city) {
  const operation = new Operation();

  getWeather(city, operation.nodeCallback);

  return operation;
}

function Operation() {

  const operation = {
    successReactions: [],
    errorReactions: []
  };

  operation.fail = function fail(error) {
    operation.state = "failed";
    operation.error = error;
    operation.errorReactions.forEach(r => r(error));
  };

  operation.succeed = function succeed(result) {
    operation.state = "succeeded";
    operation.result = result;
    operation.successReactions.forEach(r => r(result));
  };

  operation.resolve = function (callbackResult) {

    if (callbackResult && callbackResult.then) {
      callbackResult.then(operation.succeed, operation.fail);
    }
    else operation.succeed(callbackResult);

  };

  operation.onCompletion = function setCallbacks(onSuccess, onError) {
    const proxyOp = new Operation();

    function successHandler(result) {
      if (onSuccess) {
        const callbackResult = onSuccess(result);
        proxyOp.resolve(callbackResult);
        return;
      }
      proxyOp.succeed(result);
    }

    function errorHandler(error) {
      if (onError) {
        const callbackResult = onError(error);
        proxyOp.resolve(callbackResult);
        return;
      }
      proxyOp.fail(error)
    }

    if (operation.state == "succeeded") {
      successHandler(operation.result);
    } else if (operation.state == "failed") {
      errorHandler(operation.error)
    } else {
      operation.successReactions.push(successHandler);
      operation.errorReactions.push(errorHandler);
    }

    return proxyOp;
  };
  operation.then = operation.onCompletion;

  operation.onFailure = function onFailure(onError) {
    return operation.onCompletion(null, onError);
  };
  operation.catch = operation.onFailure;

  operation.nodeCallback = function nodeCallback(error, result) {
    if (error) {
      operation.fail(error);
      return;
    }
    operation.succeed(result);
  };


  return operation;
}

function doLater(func) {
  setTimeout(func, 1);
}

function fetchCurrentCityThatFails() {
  var operation = new Operation();
  doLater(() => operation.fail("GPS broken"));
  return operation;
}

test("error recovery", function (done) {

  fetchCurrentCityThatFails()
    .catch(function (error) {
      return "default city";
    })
    .then(function (city) {
      expect(city).toBe("default city");
      return fetchWeather(city);
    })
    .then(function (weather) {
      console.log(weather);
      done();
    });

});

test("error recovery bypassed if not needed", function (done) {

  fetchCurrentCity()
    .catch(function (error) {
      return "default city";
    })
    .then(function (city) {
      expect(city).toNotBe("default city");
      return fetchWeather(city);
    })
    .then(function (weather) {
      console.log(weather);
      done();
    });

});

test("error fall through", function (done) {

  const multiDone = callDone(done).afterTwoCalls();

  fetchCurrentCityThatFails()
    .then(function (city) {
      return fetchWeather(city);
    })
    .catch(error => multiDone());

  // catch responds to any upstream failure
  fetchCurrentCity()
    .then(function (city) {
      // don't pass city so fetchWeather fails
      return fetchWeather();
    })
    .catch(error => multiDone());

});

test("life is full of async, nesting is inevitable, let's do something about it", function (done) {

  fetchCurrentCity()
    .then(function (city) {
      return fetchWeather(city);
    })
    .then(weather => done());

});

test("lexical parallelism", function (done) {

  const city = "NYC";
  const weatherOp = fetchWeather(city);
  const forecastOp = fetchForecast(city);
  console.log("before completion handlers");

  weatherOp.onCompletion(function (weather) {

    forecastOp.onCompletion(function (forecast) {

      console.log(`It's currently ${weather.temp} in ${city} with a five day forecast of ${forecast.fiveDay}`);
      done();

    })

  })
});

test("register error callback async", function (done) {

  var operationThatErrors = fetchWeather();

  doLater(function () {

    operationThatErrors.onFailure(() => done());

  });

});

test("register success callback async", function (done) {

  var operationThatSucceeds = fetchCurrentCity();

  doLater(function () {

    operationThatSucceeds.onCompletion(() => done());

  });

});

test("noop if no success handler passed", function (done) {

  const operation = fetchCurrentCity();

  // noop should register for success handler
  operation.onFailure(error => done(error));

  // trigger success to make sure noop registered 
  operation.onCompletion(result => done());

});

test("noop if no error handler passed", function (done) {

  const operation = fetchWeather();

  // noop should register for error handler
  operation.onCompletion(result => done(new Error("shouldn't succeed")));

  // trigger failure to make sure noop registered 
  operation.onFailure(error => done());

});

test("pass multiple callbacks - all of them are called", function (done) {

  const operation = fetchCurrentCity();

  const multiDone = callDone(done).afterTwoCalls();

  operation.onCompletion(result => multiDone());
  operation.onCompletion(result => multiDone());

});

test("fetchCurrentCity pass the callbacks later on", function (done) {

  // initiate operation
  const operation = fetchCurrentCity();

  // register callbacks
  operation.onCompletion(
    result => done(),
    error => done(error));

});

/* Avoid timing issues with initializing a database
 // initiate operation
 const initDb = initiateDB();

 // register callbacks
 initDb.onCompletion(function(db){
 db.InsertPayment();
 });

 initDb.onCompletion(function(db){
 db.InsertUser();
 })
 );*/
