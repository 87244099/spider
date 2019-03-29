const https = require("https");
const fs = require("fs");
const http = require("http");
const url = require("url");
const path = require("path");

//创建蜘蛛
function Spider(seedUrl){
	this.urlsManager = new UrlsManager();
	this.runId = 0;
	this.seedUrl = seedUrl;
	this.errReports = [];

	//加入一条初始化的链接
	this.urlsManager.add({
		url: this.seedUrl,
		reffer: ''
	});

}
Spider.prototype = {
	Constructor: Spider,
	//开始爬取
	start: function(){
		this.run();
	},
	run: function(){
		
		this.printRunMsg();

		var $SpiderThis = this;

		var currentInfo = this.urlsManager.current();
		//组织好异步请求链
		//url里面有可能包含中文等url解析了的字符串，要进行转义，比如中文的句号“。”
		promiseRequest(encodeURI(currentInfo.url)).then(function(response){
			//请求OK，然后开始处理响应
			
			//响应码错误
			if(response.statusCode >=200 || response.statusCode <300){//2xx响应
				
				$SpiderThis.urlsManager.update(currentInfo.url, {
					statusCode: response.statusCode
				});
			
			}else if(response.statusCode >= 300 && response.statusCode <400 ) {//3xx响应

				//记录重定向的信息
				$SpiderThis.urlsManager.update(currentInfo.url, {
					statusCode: response.statusCode,
					location : response.headers ? response.headers.location : ''
				});

			}else{
				
				$SpiderThis.urlsManager.update(currentInfo.url, {
					statusCode: response.statusCode
				});

			}

			return response;

		})
		.then(promiseResponse).then(function(html){
			
			var isInnerChain = (url.parse(currentInfo.url).hostname === url.parse($SpiderThis.seedUrl).hostname);
			if(isInnerChain){
				//对html进行加工
				var htmlUtil = HtmlUitl(html);

				var currentUrl = currentInfo.url;
			
				// var htmlMd5 = htmlUtil.getMd5(html);//得到一个加密值
				var links = htmlUtil.getLinks(html);//获取页面的绝对所有链接	
				//对链接进行补全
				var absLinks = htmlUtil.transToAbsLinks(links, currentUrl);

				$SpiderThis.urlsManager.update(currentInfo.url, {
					url: currentUrl,
					// hash: htmlMd5,
					childUrls: absLinks
				});

				//将链接加入管理器
				absLinks.forEach(function(link, index){
					// var isInner = (url.parse(link).hostname === url.parse(currentUrl).hostname);
					$SpiderThis.urlsManager.add({
						url: link,
						reffer: currentUrl
					});

				});

			}else{

				$SpiderThis.urlsManager.update(currentInfo.url, {
					url: currentInfo.url,
					// hash: htmlMd5,
					childUrls: []
				});

			}

			//执行下一步
			$SpiderThis.next();

		}).catch(function(){
			$SpiderThis.nextWhenErr.apply($SpiderThis, arguments);
		});
	},
	next: function(){
	
		this.urlsManager.current().crawed=true;//标记当前链接已经爬取
		if(!this.urlsManager.allCrawed()){//判断是否还有链接可以进行爬取
			console.log("爬取下一条链接..."+ this.urlsManager.urls.length +" "+ this.urlsManager.current().url);
			this.run();
		}else{
			console.log("爬取结束...");
			this.onEnd();
		}
	},
	printRunMsg: function(){
		this.runId++;
		var arr = new Array(5);
		arr.length = this.runId%5;
		console.log("爬取链接中" + arr.join('.'));
	},
	nextWhenErr: function(err){

		this.next();

		var currentInfo = this.urlsManager.current();
		this.errReports.push({
			err: err,
			currentInfo: currentInfo
		});

	},
	onEnd: function(){
		this.saveResult(this.urlsManager.list);
		this.saveError();
	},
	onStart: function(){

	},
	saveResult: function(urlInfoList){

		var nameMap = {
			"reffer": "1、来源页面",
			"url": "2、链接",
			"statusCode": "3、状态码",
			"location" : "4、重定向位置"
		};

		var seedUrlObj = url.parse(this.seedUrl);
		//按链接类型，生成两份报告
		var innerUrlInfoList = urlInfoList.filter(function(item){
			return url.parse(item.url).hostname == seedUrlObj.hostname;
		});

		var outerUrlInfoList = urlInfoList.filter(function(item){
			return url.parse(item.url).hostname != seedUrlObj.hostname;
		});

		var result = "";
		result += "\n站内异常链接：\n";
		result += format(innerUrlInfoList).join('\n\n');
		result += "\n\n\n\n站外异常链接：\n";
	 	result += format(outerUrlInfoList).join('\n\n');

	 	console.log(urlInfoList);
	 	console.log(result);
		var checkResultFile = path.join(__dirname, "/seo/checkResult.txt");
		fs.writeFile(checkResultFile, result, function(err){
			if(err){
				return console.log(err);
			}
			console.log("保存成功");
		});



		function sortStatusCode(item1, item2){
			return item1.statusCode - item2.statusCode;
		}
		function filterNormal(item){
			return item.statusCode < 200 || item.statusCode>=300;
		}


		function format(urlInfoList){
			return urlInfoList.sort(sortStatusCode).filter(filterNormal).map(function(item){
				var stringArr = [];

				Object.keys(item).forEach(function(key){
					if(nameMap[key]){
						stringArr.push(nameMap[key] + " : " + item[key]);

					}

					stringArr.sort();
				});

				return stringArr.join("\n");
			});
		}	
	},
	saveError: function(){
		var errorResultFilePath = path.join(__dirname, "/seo/errorResult.txt");
		var result = "错误报告：\n";
		result += this.errReports.map(function(item){
			return JSON.stringify(item.err) + "\n" +JSON.stringify(item.currentInfo);
		}).join('\n\n');

		fs.writeFile(errorResultFilePath, result, function(err){
			if(err){
				return console.log(err);
			}
			console.log("错误日志收集成功");
		});
	}
};


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

		//接受数据时
		var resultString = "";
		response.on("data", function(buffer){
			resultString += buffer.toString("utf-8");
		});
		//响应错误时
		response.on("error", reject);
		//响应结束时
		response.on("end", function(){
			resolve(resultString);
		});

	});
}

function createRequestOptions(requestUrl, isHttps){
	var requestUrlObj = url.parse(requestUrl, true, true);
	//创建请求上下文
	var options = {
		protocol:  requestUrlObj.protocol || 'http:',//协议
		host: requestUrlObj.host,//发送至的服务器的域名或 IP 地址
		hostname: requestUrlObj.hostname,// host 的别名
		port: isHttps ? (requestUrlObj.port || 443) : (requestUrlObj.port || 80),//端口号默认
		path: requestUrlObj.path || '/',//请求路径，默认
		method: "GET",//请求方法
		headers: {//加上请求头，不然可能500或这403
			"User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3472.3 Safari/537.36"
		}
	};
	return options;
}

//人为构造错误进行通知
function createError(){

}
function checkLinkDemo(){
	var outerLink = url.parse('http://www.fff.com');
	var baseLinks = url.parse("//jz.fkw.com//case.html");
	var absLinks = url.parse("http://www.fff.com/reg.html?site=1");
	var notAbsLinks = url.parse("/reg.html?clone=9861385&templateId=1010&_ta=25");
	var emptyLink = url.parse("");

	console.log(outerLink);
	console.log(baseLinks);
	console.log(absLinks);
	console.log(notAbsLinks);
	console.log(emptyLink);

} 
// console.log(url.parse("http://jz.fkw.com//?a=265"));
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
	transToAbsLinks: function(links, refUrl){

		var parentUrlObj = url.parse(refUrl, true, true);

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
				  host: 'jz.fkw.com/',
				  port: null,
				  hostname: 'jz.fkw.com/',
				  hash: null,
				  search: '?a=265',
				  query: 'a=265',
				  pathname: '/',
				  path: '/?a=265',
				  href: 'http://jz.fkw.com//?a=265' }
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


/**
 * 1、检查内链有无异常
 * 2、检查外链有无异常
 * 3、链接来源于哪个页面
 * 4、如果进行重新向、重定向的位置是哪里
 */
//url管理器
function UrlsManager(){
	//存储url信息的列表
	this.urls = [];
	this.list = [];
	/*
	[{
		crawed: false,//是否被爬取
		url: '',//当前的url
		reffer: '',//reffer
		statusCode: '',//状态码
		location: '',//重定向位置
		childUrls: [],//页面子链接
	}]
	 */

}
UrlsManager.prototype = {
	Constructor: UrlsManager,
	add: function(info){
		if(!this.exist(info.url)){
			this.urls.push(info.url);
			this.list.push(Object.assign(
				{
					statusCode: -1,
					crawed: false,
					childUrls: [] 
				},
				info
			));
		}
	},
	exist: function(url){
		return this.urls.includes(url);
	},
	//当前的
	current: function(){
		var currentIndex = -1;
		return this.list.some(function(item, index){
			if(!item.crawed){
				currentIndex = index;
				return true;
			}

			return false;
		}) ? this.list[currentIndex] : null;
	},
	//最后一个
	last: function(){
		return this.list[this.urls.length-1];	
	},
	allCrawed: function(){
		return this.list[this.urls.length-1].crawed === true;
	},
	update: function(url, info){
		// console.log(url, info);
		// console.log(url, this.urls);
		Object.assign(this.list[this.urls.indexOf(url)], info);
	}
};



var seedUrl = "https://jz.fkw.com/";
new Spider(seedUrl).start();

