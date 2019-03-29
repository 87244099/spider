var crypto = require("crypto");
var url = require("url");
var md5 = crypto.createHash("md5");
// var iconv = require('iconv-lite');//解决中文乱码的问题
var zlib = require("zlib");

// console.log(md5.update("wgd").digest("hex"));
// 
function createMd5(string){
	var md5 = crypto.createHash("md5");
	md5.update(string);
	return md5.digest("hex");
}

/*//怎么将不完整的链接补全完整？
console.log(url.parse("http://jz.fff.com"));
console.log(url.parse("http://jz.fff.com"));

findSameHashLinks([
	{hash: "a", b: 2},
	{hash: "a", b: 3},
	{hash: "b", b: 6}
]);*/

function findSameHashLinks(list){
	var infoList = [];

	var hashObj = {};
	//看下哈希值相同的，有多少个？
	list.forEach(function(item, index){

		if(!hashObj[item.hash]){
			hashObj[item.hash] = [];
		}
		hashObj[item.hash].push(Object.assign({}, item));
	});

	Object.keys(hashObj).forEach(function(key){
		var items = hashObj[key];

		hashObj[key].forEach(function(item){
			delete item.childUrls;
		});	

		if(items.length <= 1){
			delete hashObj[key];
		}

	});
	return hashObj;
}



const https = require("https");
const fs = require("fs");
const http = require("http");
// const url = require("url");
const path = require("path");


var currentUrl = "http://www.iybys.top/";
promiseRequest(encodeURI(currentUrl)).then(function(response){
	//请求OK，然后开始处理响应
	
	//响应码错误
	if(response.statusCode <200 || response.statusCode >=300){
		console.log("响应码错误", response.statusCode);
	}

	return response;

})
.then(promiseResponse).then(function(html){
	//对html进行加工
	var htmlUtil = HtmlUitl(html);

	var htmlMd5 = htmlUtil.getMd5(html);//得到一个加密值
	var links = htmlUtil.getLinks(html);//获取页面的所有链接	

	//对链接进行补全
	var absLinks = transformAbsLinks(links, currentUrl);
	
	console.log(123, html);

}).catch(function(){
	console.log("error", JSON.stringify(arguments));
});



function promiseRequest(targetUrl){
	//创建请求上下文
	return new Promise(function(resolve, reject){
		var urlObj = url.parse(targetUrl);
		var isHttps = urlObj.protocol == "https:";
		var options = createRequestOptions(targetUrl, isHttps);

		//开始请求，并等待响应
		var request = isHttps ? https.request(options, resolve) : http.request(options, resolve);

		//请求过程发生错误时
		request.on("error", reject);
		//请求超时
		request.on("timeout", reject);
		request.end();
	});
}
function promiseResponse(response){
	//promise响应
	return new Promise(function(resolve, reject){
		var contentEncoding = response.headers['content-encoding'];
		if(contentEncoding === 'undefinded'){
			response.setEncoding("utf-8");
		}

		//接受数据时
		var html  = [];
		var length = 0;

		var zlibOptions = {
	        flush: zlib.Z_SYNC_FLUSH,
	        finishFlush: zlib.Z_SYNC_FLUSH
	    };
	    var responseContent = zlib.createGunzip(zlibOptions);

	    response.pipe(responseContent);

		responseContent.on("data", function(buffer){
			html.push(buffer);
			length += buffer.length;
		});
		//响应结束时
		responseContent.on("end", function(data){
			var buffer = Buffer.concat(html, length);
			console.log(123, buffer.toString(), data);
			/*var buffer = Buffer.concat(html, length);

			if(response.headers["content-length"] != buffer.length){
				console.log("获取的数据有误");
				console.log(response.headers["content-length"] , buffer.length);
				console.log(response.statusCode);
			}

			console.log(buffer.toString("utf-8"));
			if(response.headers["content-encoding"] && response.headers["content-encoding"].includes("gzip")){
				zlib.gunzip(buffer, function(err, dezipped){
					console.log(err, dezipped);
					if(err){
						reject(err);
					}else{
						resolve(dezipped.toString());
					}
				});

			}else{
				var resultString = buffer.toString();
				resolve(resultString);
			}*/
		});

		//响应错误时
		responseContent.on("error", reject);
	});
}

function createRequestOptions(requestUrl, isHttps){
	var requestUrlObj = url.parse(requestUrl, true, true);
	//创建请求上下文
	var options = {
		protocol:  requestUrlObj.protocol || 'http',//协议
		host: requestUrlObj.host,//发送至的服务器的域名或 IP 地址
		hostname: requestUrlObj.hostname,// host 的别名
		port: isHttps ? 443 : (requestUrlObj.port || 80),//端口号默认
		path: requestUrlObj.path || '/',//请求路径，默认
		method: "GET",//请求方法
		headers: {//加上请求头，不然可能500或这403
			"User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3472.3 Safari/537.36",
			'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
			'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6',
			"Upgrade-Insecure-Requests":"1"
		}
	};
	return options;
}

function transformAbsLinks(links, parentLink){
	var parentUrlObj = url.parse(parentLink, true, true);

	return links.map(function(link, index){

		/**
		 * 可以利用url.parse解析的结果进行链接类型的判断
		 * 外链
		 * 内链
		 * 	绝对链接
		 * 	相对链接
		 * 重复链接
		 * 空链接
		 */
		 /*
		 Url {
			  protocol: 'http:',
			  slashes: true,
			  auth: null,
			  host: 'jz.fff.com',
			  port: null,
			  hostname: 'jz.fff.com',
			  hash: null,
			  search: '?a=265',
			  query: 'a=265',
			  pathname: '/',
			  path: '/?a=265',
			  href: 'http://jz.fff.com/?a=265' }
		  */
		
		var urlObj = url.parse(link, true, true);
		//是否带协议开头的
		var isStatWithProtocol = link.startsWith("http") || link.startsWith("https");
		var isHostSame = url.hostname == parentUrlObj.hostname;//存在域名，且和父域名相同的情况下
		var isAbsUrl = !!url.hostname;
		if(isAbsUrl){//绝对链接


		}else{//相对链接

			urlObj.protocol = urlObj.protocol || parentUrlObj.protocol;//继承协议
			urlObj.hostname = urlObj.hostname || parentUrlObj.hostname;//继承主机名

		}

		return urlObj.format();
	});
}

//人为构造错误进行通知
function createError(){

}
function checkLinkDemo(){
	var outerLink = url.parse('http://www.fff.com');
	var baseLinks = url.parse("//jz.fff.com/case.html");
	var absLinks = url.parse("http://www.fff.com/reg.html?site=1");
	var notAbsLinks = url.parse("/reg.html?clone=9861385&templateId=1010&_ta=25");
	var emptyLink = url.parse("");

	console.log(outerLink);
	console.log(baseLinks);
	console.log(absLinks);
	console.log(notAbsLinks);
	console.log(emptyLink);

} 
// console.log(url.parse("http://jz.fff.com/?a=265"));
var cheerio = require("cheerio");//解析html用的库
var crypto = require("crypto");//加密用的

function HtmlUitl(html){
	if(this instanceof HtmlUitl){
		this.$ = cheerio.load(html);	
	}else{
		return new HtmlUitl(html);
	}
}
HtmlUitl.prototype = {
	Constructor: HtmlUitl,
	getLinks: function(){
		var $ = this.$;
		var links = [];
		$("a").each(function(index, item){
			links.push($(item).attr('href') || '');
		});
		// console.log(links);
		/**
		 * 可以利用url.parse解析的结果进行链接类型的判断
		 * 外链
		 * 内链
		 * 	绝对链接
		 * 	相对链接
		 * 重复链接
		 * 空链接
		 */
		
		 // console.log(links);/

		return links;
	},
	getMd5: function(){
		var $ = this.$;
		//根据页面三要素做相似性判断
		var title = $('title').text() || '';
		var keywords = $('meta[name="keywords"]').attr("content") || '';
		var description = $('meta[name="description"]').attr("content") || '';
		var copyright = $('meta[name="copyright"]').attr("content") || '';

		var linkTexts =  []; 
		$('a').each(function(index, item){
			linkTexts.push($(item).text());
		});

		var string = [title, keywords, description, copyright].concat(linkTexts).join("-");


		var md5 = crypto.createHash("md5");
		md5.update(string);
		return md5.digest("hex");
	}
};


