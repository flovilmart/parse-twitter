var _ = require("underscore");
OAuth = {};

/*
	Proper string %escape encoding
*/
OAuth.encode = function(str) {
  //       discuss at: http://phpjs.org/functions/rawurlencode/
  //      original by: Brett Zamir (http://brett-zamir.me)
  //         input by: travc
  //         input by: Brett Zamir (http://brett-zamir.me)
  //         input by: Michael Grier
  //         input by: Ratheous
  //      bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  //      bugfixed by: Brett Zamir (http://brett-zamir.me)
  //      bugfixed by: Joris
  // reimplemented by: Brett Zamir (http://brett-zamir.me)
  // reimplemented by: Brett Zamir (http://brett-zamir.me)
  //             note: This reflects PHP 5.3/6.0+ behavior
  //             note: Please be aware that this function expects to encode into UTF-8 encoded strings, as found on
  //             note: pages served as UTF-8
  //        example 1: rawurlencode('Kevin van Zonneveld!');
  //        returns 1: 'Kevin%20van%20Zonneveld%21'
  //        example 2: rawurlencode('http://kevin.vanzonneveld.net/');
  //        returns 2: 'http%3A%2F%2Fkevin.vanzonneveld.net%2F'
  //        example 3: rawurlencode('http://www.google.nl/search?q=php.js&ie=utf-8&oe=utf-8&aq=t&rls=com.ubuntu:en-US:unofficial&client=firefox-a');
  //        returns 3: 'http%3A%2F%2Fwww.google.nl%2Fsearch%3Fq%3Dphp.js%26ie%3Dutf-8%26oe%3Dutf-8%26aq%3Dt%26rls%3Dcom.ubuntu%3Aen-US%3Aunofficial%26client%3Dfirefox-a'

  str = (str + '')
    .toString();

  // Tilde should be allowed unescaped in future versions of PHP (as reflected below), but if you want to reflect current
  // PHP behavior, you would need to add ".replace(/~/g, '%7E');" to the following.
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

OAuth.signatureMethod = "HMAC-SHA1";
OAuth.version = "1.0";

/*
	Generate a nonce
*/
OAuth.nonce = function(){
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 30; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

OAuth.buildParameterString = function(obj){
	var result = {};

	// Sort keys and encode values
	if (obj) {
		_.each(_.keys(obj).sort(), function(key){
			result[key] = OAuth.encode(obj[key]);
		});
	}

	obj = result;

	// Map key=value, join them by &
	return _.map(obj, function(value, key){
		return key+"="+value;
	}).join("&");
}

/*
	Build the signature string from the object
*/

OAuth.buildSignatureString = function(method, url, parameters){
	return [method.toUpperCase(), OAuth.encode(url), OAuth.encode(parameters)].join("&");
}

/*
	Retuns encoded HMAC-SHA1 from key and text
*/
OAuth.signature = function(text, key){
	crypto = require("crypto");
	return OAuth.encode(crypto.createHmac('sha1', key).update(text).digest('base64'));
}


/* 
	Signs the current request
	request is a Parse.Cloud.HTTPOptions: http://parse.com/docs/js/symbols/Parse.Cloud.HTTPOptions.html
	oauth_parameters require: oauth_consumer_key and oauth_token to be set
	consumer_secret 
	auth_token_secret
*/
OAuth.signRequest = function(request, oauth_parameters, consumer_secret, auth_token_secret){
	

	// Set default values
	if (!oauth_parameters.oauth_nonce) {
		oauth_parameters.oauth_nonce = OAuth.nonce();
	}
	if (!oauth_parameters.oauth_timestamp) {
		oauth_parameters.oauth_timestamp = Math.floor(new Date().getTime()/1000);
	}
	if (!oauth_parameters.oauth_signature_method) {
		oauth_parameters.oauth_signature_method = OAuth.signatureMethod;
	}
	if (!oauth_parameters.oauth_version) {
		oauth_parameters.oauth_version = OAuth.version;
	}
	// Force GET method if unset
	if (!request.method) {
		request.method = "GET"
	}

	// Collect  all the parameters in one signatureParameters object
	var signatureParams = {};
	_.extend(signatureParams, request.params, request.body, oauth_parameters);
	console.log(signatureParams);
	// Create a string based on the parameters
	var parameterString = OAuth.buildParameterString(signatureParams);

	// Build the signature string
	var signatureString = OAuth.buildSignatureString(request.method, request.url, parameterString);

	// Hash the signature string
	var signature = OAuth.signature(signatureString, [OAuth.encode(consumer_secret), OAuth.encode(auth_token_secret)].join("&"));

	// Set the signature in the params
	oauth_parameters.oauth_signature = signature;
	if(!request.headers){
		request.headers = {};
	}

	// Set the authorization header
	request.headers.Authorization = ['OAuth', _.map(oauth_parameters, function(v,k){ return k+'="'+v+'"'})].join(" ");

	// Set the content type header
	request.headers["Content-Type"] = "application/x-www-form-urlencoded";
	return request;
}

/*
	Create a new instance with a user or authData parameters
*/

Twitter = function(object){
	// Check if that's a user
	this.authData = null;
	this.baseURL = "https://api.twitter.com/1.1/"
	this.OAuth = OAuth;
	console.log(typeof object);
	if (typeof object.get == "function") {
		//
		console.log("That's an object");
		this.authData = object.get("authData").twitter;
	}else if(typeof object == "object"){
		// this is an object
		this.authData = object;
	}

	if(!this.authData){
		console.log("NO AUTH DATA");
		return null;
	}

	this.consumer_key = this.authData.consumer_key;
	this.consumer_secret = this.authData.consumer_secret;
	this.auth_token = this.authData.auth_token;
	this.auth_token_secret = this.authData.auth_token_secret;
}

Twitter.buildMultipartForm = function(body, boundary){
	var r = "";
	_.each(body, function(value, key){
		r += "--"+boundary+"\n";
		if (typeof value === "string") {
			r += "Content-Disposition: form-data; name=\""+key+"\"\n\n";
			r += value;

		}else if(typeof value === "object"){
			r += "Content-Type: application/base64\n";
			r += "Content-Disposition: form-data; name=\""+key+"\" filename=\""+value.filename+"\"\n\n";
			r += value.content;
		}
		r +="\n";
	});
	r+="--"+boundary+"--";
	return r;
}

Twitter.prototype.uploadImage = function(imageURL, message){
	var apiKey = "9813a06520effc62eb415673dd23d8f9";
	var oauth_params = {
		"oauth_consumer_key"	:this.consumer_key,
		"oauth_token"			:this.auth_token,
	}
	var request = {
		url: "https://api.twitter.com/1/account/verify_credentials.json",
		method: "GET"
	}
	var oauth_params = {
		"oauth_consumer_key"	:this.consumer_key,
		"oauth_token"			:this.auth_token,
	}
	request = OAuth.signRequest(request, oauth_params, this.consumer_secret,  this.auth_token_secret);
	var r ={
		url: "http://api.twitpic.com/2/upload.json",
		method: "POST",
		body: {
			key: apiKey,
			message: message,
			imageURL: imageURL
		},
		headers: {
			'X-Auth-Service-Provider': 'https://api.twitter.com/1/account/verify_credentials.json',
			'X-Verify-Credentials-Authorization': 'OAuth realm="http://api.twitter.com/ '+_.map(oauth_params, function(v,k){ return k+'="'+v+'"'}),
		}
	}
	return Parse.Cloud.httpRequest(r);
}

Twitter.prototype.send = function(method, endpoint, params, body){
	console.log("Sending...");
	if (endpoint.indexOf("/") == 0) {
		endpoint = endpoint.slice(1,endpoint.lenght)
	}
	var request = {
		url: 		this.baseURL+endpoint,
		method: 	method
	};
	if (Object.keys(params).length>0) {
		request.params = params;
	}
	if (Object.keys(body).length>0) {
		request.body = body;
	}
	var oauth_params = {
		"oauth_consumer_key"	:this.consumer_key,
		"oauth_token"			:this.auth_token,
	}
	request = OAuth.signRequest(request, oauth_params, this.consumer_secret,  this.auth_token_secret);
	console.log(oauth_params);
		// Encode the body properly, the current Parse Implementation don't do it properly
	request.body = OAuth.buildParameterString(request.body);
	console.log(request);
	return Parse.Cloud.httpRequest(request);
}

var Buffer = require("buffer").Buffer;
Twitter.prototype.sendMultipart = function(method, endpoint, params, body){
	if (endpoint.indexOf("/") == 0) {
		endpoint = endpoint.slice(1,endpoint.lenght)
	}
	var request = {
		url: 		this.baseURL+endpoint,
		method: 	method
	};
	// Do not add the params or body to the sig
	/*if (Object.keys(params).length>0) {
		request.params = params;
	}
	if (Object.keys(body).length>0) {
		request.body = body;
	}*/
	var oauth_params = {
		"oauth_consumer_key"	:this.consumer_key,
		"oauth_token"			:this.auth_token,
	}
	var boundary = "cce6735153bf14e47e999e68bb183e70a1fa7fc89722fc1efdf03a917340";
	request = OAuth.signRequest(request, oauth_params, this.consumer_secret,  this.auth_token_secret);
	request.headers["Content-Type"] = "application/octet-stream";
	request.body = new Buffer(Twitter.buildMultipartForm(body, boundary));
	//request.body = body;
	//request.headers["Content-Type"] = "multipart/form-data;boundary="+boundary;
	//request.body = Twitter.buildMultipartForm(body, boundary);
	request.headers["Content-Length"] = request.body.length;


	var p =  Parse.Cloud.httpRequest(request);
	console.log(request);
	return p;
}

Twitter.prototype.get = function(endpoint, params, body){
	return this.send("GET", endpoint, params, body);
}

Twitter.prototype.post = function(endpoint, params, body){
	return this.send("POST", endpoint, params, body);
}


module.exports= Twitter;

