const https = require("https");
const fs = require("fs");
const http = require("http");
const url = require("url");
const path = require("path");



/*//开始请求，并等待响应
var requestUrl = "http://jz.fkw.com.faidev.cc/index.jsp?a=10";
var options = createRequestOptions(requestUrl);
var request = http.request(options, function(response){
	//响应码错误
	if(response.statusCode <200 || response.statusCode >=300){
		console.log(response.statusCode);
	}

	promiseResponse(response)
		.then(function(html){

			var htmlUtil = HtmlUitl(html);

			var htmlMd5 = htmlUtil.getMd5(html);//得到一个加密值
			var links = htmlUtil.getLinks(html);//获取页面的所有链接		
			//对链接进行补全
			var absLinks = transformAbsLinks(links, 'http://jz.fkw.com.faidev.cc/index.html');
			console.log(absLinks);


		},function(err){
			console.log(err);
		}).then(function(data){

		});
});
//请求过程发生错误时
request.on("error", function(err){
	console.log("request error", err);
});
//请求超时
request.on("timeout", function(err){
	console.log("请求超时");
});
//请求结束
request.end();*/

//爬取的链接管理器具
function CrawUrlsManager(){
	this.urls = [];//链接集合
	this.infos = [];//爬取链接的信息集合
	/**
	 * [
	 * 		{
	 * 			crawed: false,
	 * 			reffer: jz.fkw.com.faidev.cc
	 * 		}
	 * ]
	 */
}
CrawUrlsManager.prototype = {
	Constructor: CrawUrlsManager,
	//判断链接是否已经被爬取
	hasCraw: function(url){
		return this.exits(url) && this.infos[ this.urls.indexOf(url) ].crawed === true;
	},
	//判断链接是否需要被爬取
	needCraw: function(url){
		return this.exits(url) && !this.hasCraw(url);
	},
	//标记链接已经被爬取
	setCraw: function(url){
		if(this.exits(url)){
			this.infos[ this.urls.indexOf(url) ].crawed = true;
		}
	},
	//判断链接是否存在
	exits: function(url){
		return this.urls.includes(url);
	},	
	// 添加链接
	add: function(info){
		//被爬取、已经包含的链接
		if(!this.hasCraw(info.url) && !this.exits(info.url)){
			this.urls.push(info.url);
			this.infos.push(Object.assign(info, {
				crawed: false
			}));
		}
	},
	//全部都被爬取了
	allCrawed: function(){
		return this.infos[this.urls.length-1].crawed === true;
	},
	current: function(){//获取当前可以进行爬取的链接
		var urlIndex = -1;
		this.infos.some(function(info, index){
			if(!info.crawed){
				urlIndex = index;
				return true;
			}

			return false;
		});

		return this.urls[urlIndex];
	},
	updateCurrentInfo: function(data){
		Object.assign(this.currentInfo(), data);
	},
	currentInfo: function(){
		return this.getInfoByUrl(this.current());
	},
	getInfoByUrl: function(url){
		return this.infos[this.urls.indexOf(url)];
	}
};
//页面分析器
function HtmlAnalysis(html){

}
//创建蜘蛛
function Spider(seedUrl){
	this.urlsManager = new CrawUrlsManager();
	this.results = [];
	this.errReports = [];
	this.runId = 0;
	this.seedUrl = seedUrl;

	this.outerUrlsManager = new CrawUrlsManager();
}
Spider.prototype = {
	Constructor: Spider,
	//开始爬取
	start: function(){
		console.log("开始爬取");
		this.urlsManager.add({
			url: this.seedUrl, 
			reffer: null,
		});//把链接加入管理器
		this.onStart();
		this.run();
	},
	run: function(){
		this.runId++;
		var arr = new Array(5);
		arr.length = this.runId%5;
		console.log("爬取链接中" + arr.join('.'));
		

		var $SpiderThis = this;
		var currentInfo = this.urlsManager.currentInfo();
		//组织好异步请求链
		//url里面有可能包含中文等url解析了的字符串，要进行转义，比如中文的句号“。”
		promiseRequest(encodeURI(currentInfo.url)).then(function(response){
			//请求OK，然后开始处理响应
			
			//响应码错误
			if(response.statusCode <200 || response.statusCode >=300){
				$SpiderThis.errReports.push({
					statusCode: response.statusCode,//响应码
					targetUrl: currentInfo.url,//目标链接
					reffer: currentInfo.reffer,//访问来源
					location : response.headers ? response.headers.location : ''
				});
			}

			return response;

		})
		.then(promiseResponse).then(function(html){
			var currentUrl = $SpiderThis.urlsManager.current();
			//对html进行加工
			var htmlUtil = HtmlUitl(html);

			var htmlMd5 = htmlUtil.getMd5(html);//得到一个加密值
			var links = htmlUtil.getLinks(html);//获取页面的所有链接	

			//对链接进行补全
			var absLinks = transformAbsLinks(links, currentUrl);
			$SpiderThis.urlsManager.updateCurrentInfo({
				url: currentUrl,
				hash: htmlMd5,
				childUrls: absLinks
			});

			//只爬取站内的链接、而且是未爬取过的链接

			absLinks.forEach(function(link, index){
				var isInner = (url.parse(link).hostname === url.parse(currentUrl).hostname);

				if(isInner){//站内链接
					//把子链接都添加进去
					$SpiderThis.urlsManager.add({
						url: link,
						reffer: currentUrl
					});
				}else{//收集站外链接
					$SpiderThis.outerUrlsManager.add({
						url: link,
						reffer: currentUrl
					});
				}	

			});

			//执行下一步
			$SpiderThis.next();

		}).catch(function(){
			$SpiderThis.nextWhenErr.apply($SpiderThis, arguments);
		});
	},
	next: function(){
		var $SpiderThis = this;
		$SpiderThis.urlsManager.setCraw($SpiderThis.urlsManager.current());//标记当前链接已经爬取
		var allCrawed = $SpiderThis.urlsManager.allCrawed();//判断当前是否已经爬完
		if(!allCrawed){
			console.log("爬取下一条链接..."+ this.urlsManager.urls.length +" "+$SpiderThis.urlsManager.current());
			$SpiderThis.run();
		}else{
			console.log("爬取结束...", $SpiderThis.results.length);
			this.onEnd();
		}
	},
	nextWhenErr: function(err){
		console.log(err);
		this.next();
	},
	onEnd: function(){

		//根据结果分析，多条不同链接指向同一个页面的情况
		// var someHashLinksResult = findSameHashLinks(this.urlsManager.infos);

		/*fs.writeFile( path.join(__dirname, "/seo/result.txt"), JSON.stringify(someHashLinksResult), function(err){
			if(err){
				console.log(err);
			}
		});*/

		//站内死链接
		fs.writeFile( path.join(__dirname, "/seo/dieLinks.txt"), JSON.stringify(this.errReports), function(err){
			if(err){
				console.log(err);
			}
		});
		//检查站外链接
		new OuterSpider(this.outerUrlsManager).start();

	},
	onStart: function(){
	},
	checkOuterLinks: function(){

	}
};

function OuterSpider(resultUrlManager){
	this.urlsManager = resultUrlManager;
	this.results = [];
	this.errReports = [];
	this.runId = 0;
}
OuterSpider.prototype = {
	Constructor: OuterSpider,
	start: function(){
		this.run();
	},
	run: function(){
		this.runId++;
		var arr = new Array(5);
		arr.length = this.runId%5;
		console.log("OuterSpider爬取链接中" + arr.join('.'));
		

		var $SpiderThis = this;
		var currentInfo = this.urlsManager.currentInfo();
		//组织好异步请求链
		//url里面有可能包含中文等url解析了的字符串，要进行转义，比如中文的句号“。”
		promiseRequest(encodeURI(currentInfo.url)).then(function(response){
			//请求OK，然后开始处理响应
			
			//响应码错误
			if(response.statusCode <200 || response.statusCode >=300){
				$SpiderThis.errReports.push({
					statusCode: response.statusCode,//响应码
					targetUrl: currentInfo.url,//目标链接
					reffer: currentInfo.reffer,//访问来源
					location : response.headers ? response.headers.location : ''
				});
			}

			$SpiderThis.next();
			return response;


		}).catch(function(){
			$SpiderThis.nextWhenErr.apply($SpiderThis, arguments);
		});
	},
	next: function(){
		var $SpiderThis = this;
		$SpiderThis.urlsManager.setCraw($SpiderThis.urlsManager.current());//标记当前链接已经爬取
		var allCrawed = $SpiderThis.urlsManager.allCrawed();//判断当前是否已经爬完
		if(!allCrawed){
			console.log("OuterSpider爬取下一条链接..."+ this.urlsManager.urls.length +" "+$SpiderThis.urlsManager.current());
			$SpiderThis.run();
		}else{
			console.log("OuterSpider爬取结束...", $SpiderThis.results.length);
			this.onEnd();
		}
	},
	nextWhenErr: function(err){
		console.log(err);
		this.next();
	},
	onEnd: function(){
		fs.writeFile( path.join(__dirname, "/seo/dieOuterLinks.txt"), JSON.stringify(this.errReports), function(err){
			if(err){
				console.log(err);
			}
		});
	}
};

var seedUrl = "http://jz.fkw.com.faidev.cc/";
new Spider(seedUrl).start();

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
		port: isHttps ? 443 : (requestUrlObj.port || 80),//端口号默认
		path: requestUrlObj.path || '/',//请求路径，默认
		method: "GET",//请求方法
		headers: {//加上请求头，不然可能500或这403
			"User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3472.3 Safari/537.36"
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
			  host: 'jz.fkw.com.faidev.cc',
			  port: null,
			  hostname: 'jz.fkw.com.faidev.cc',
			  hash: null,
			  search: '?a=265',
			  query: 'a=265',
			  pathname: '/',
			  path: '/?a=265',
			  href: 'http://jz.fkw.com.faidev.cc/?a=265' }
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
	var baseLinks = url.parse("//jz.fkw.com.faidev.cc/case.html");
	var absLinks = url.parse("http://www.fff.com/reg.html?site=1");
	var notAbsLinks = url.parse("/reg.html?clone=9861385&templateId=1010&_ta=25");
	var emptyLink = url.parse("");

	console.log(outerLink);
	console.log(baseLinks);
	console.log(absLinks);
	console.log(notAbsLinks);
	console.log(emptyLink);

} 
// console.log(url.parse("http://jz.fkw.com.faidev.cc/?a=265"));
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
