window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});// 自动资源下载服务器 - Node.js版本
// 使用方法: node auto-download-server.js
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 通用的JS模块加载器代码模板
const COMMON_JS_CONTENT = `(function r(e, n, t) {
function i(u, f, c) {
if (!n[u]) {
if (!e[u]) {
var l = u;
u.includes('./') && (l = (l = u.split('/'))[l.length - 1]);
if (!e[l]) {
var _ = 'function' == typeof __require && __require;
if (!f && _) return _(l, !0);
if (o) return o(l, !0);
throw new Error('Cannot find module "' + u + '"');
}
u = l;
}
var p = n[u] = {
exports: {}
};
e[u][0].call(p.exports, function(r) {
return i(e[u][1][r] || r, void 0, r.includes('./') ? void 0 : r);
}, p, p.exports, r, e, n, t);
}
c && n[u] && !n[c] && (n[c] = n[u]);
return n[u].exports;
}
for (var o = 'function' == typeof __require && __require, u = 0; u < t.length; u++) i(t[u]);
return i;
})({}, {}, []);`;

// 配置信息（已移除本地备用路径相关配置）
const config = {
    // 官网资源URL前缀
    officialResourceBase: 'https://xxz-xyzw-res.hortorgames.com/remote/',
    // 本地资源基础路径
    localResourceBase: './',
    // 本地assets文件夹路径（用于存储remote下载的资源）
    localAssetsPath: './assets',
    // 服务器端口
    port: 8080,
    // 日志级别：0=静默，1=错误，2=警告，3=信息，4=详细
    logLevel: 3,
    // 是否启用自动下载
    enableAutoDownload: true,
    // 是否缓存404错误
    cache404Errors: true,
    // 下载超时时间（毫秒）
    downloadTimeout: 30000,
    // 最大并发下载数
    maxConcurrentDownloads: 5
};

// 用于存储404错误的缓存
const notFoundCache = new Set();
// 并发下载控制
const downloadQueue = [];
let activeDownloads = 0;

// 日志函数
function log(level, ...args) {
    if (level <= config.logLevel) {
        const prefixes = ['', '\x1b[31m[ERROR]\x1b[0m', '\x1b[33m[WARN]\x1b[0m', '\x1b[32m[INFO]\x1b[0m', '\x1b[36m[DEBUG]\x1b[0m'];
        console.log(`${prefixes[level] || ''} ${new Date().toLocaleTimeString()} -`, ...args);
    }
}

// 确保目录存在
function ensureDirectoryExists(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    
    try {
        fs.mkdirSync(dirname, { recursive: true });
        log(4, `创建目录: ${dirname}`);
        return true;
    } catch (error) {
        log(1, `无法创建目录: ${dirname}`, error);
        return false;
    }
}

// 从官网下载资源 - 模拟浏览器访问以绕过防盗链限制
function downloadFromOfficial(resourcePath) {
    return new Promise((resolve, reject) => {
        const officialUrl = config.officialResourceBase + resourcePath;
        // 将remote资源下载到assets文件夹
        const localFilePath = path.join(config.localAssetsPath, resourcePath);
        
        // 检查是否已经确认该资源不存在
        if (config.cache404Errors && notFoundCache.has(resourcePath)) {
            log(3, `跳过已知不存在的资源: ${resourcePath}`);
            reject(new Error('资源已知不存在'));
            return;
        }

        log(3, `开始从官网获取资源: ${officialUrl}`);
        log(3, `将保存到: ${localFilePath}`);
        
        // 确保目录存在
        if (!ensureDirectoryExists(localFilePath)) {
            reject(new Error('无法创建目录'));
            return;
        }
        
        // 设置超时
        const timeoutId = setTimeout(() => {
            reject(new Error('获取超时'));
        }, config.downloadTimeout);
        
        // 模拟浏览器请求头信息，绕过防盗链
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Referer': config.officialResourceBase,
                'Origin': config.officialResourceBase,
                'Connection': 'keep-alive'
            }
        };
        
        // 发起HTTPS请求，模拟浏览器访问
        https.get(officialUrl, options, (response) => {
            clearTimeout(timeoutId);
            
            // 处理重定向
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                log(3, `检测到重定向: ${response.headers.location}`);
                const redirectedUrl = response.headers.location.startsWith('http') 
                    ? response.headers.location 
                    : url.resolve(config.officialResourceBase, response.headers.location);
                
                // 对重定向的URL发起请求
                https.get(redirectedUrl, options, (redirectedResponse) => {
                    processResponse(redirectedResponse, localFilePath, resourcePath, resolve, reject);
                }).on('error', handleRequestError(resourcePath, reject));
                return;
            }
            
            // 处理正常响应
            processResponse(response, localFilePath, resourcePath, resolve, reject);
        }).on('error', handleRequestError(resourcePath, reject));
    });
}

// 处理HTTP响应的辅助函数
function processResponse(response, localFilePath, resourcePath, resolve, reject) {
    if (response.statusCode !== 200) {
        if (response.statusCode === 404 && config.cache404Errors) {
            notFoundCache.add(resourcePath);
        }
        const error = new Error(`获取失败，状态码: ${response.statusCode}`);
        log(2, error.message, resourcePath);
        reject(error);
        return;
    }
    
    // 创建写入流
    const fileStream = fs.createWriteStream(localFilePath);
    let totalBytes = 0;
    
    response.on('data', (chunk) => {
        totalBytes += chunk.length;
    });
    
    // 管道传输数据到文件
    response.pipe(fileStream);
    
    fileStream.on('finish', () => {
        fileStream.close();
        log(4, `成功获取并保存资源: ${resourcePath}, 大小: ${totalBytes} 字节`);
        resolve(localFilePath);
    });
    
    fileStream.on('error', (error) => {
        fs.unlink(localFilePath, () => {}); // 尝试删除损坏的文件
        log(1, `写入文件失败: ${localFilePath}`, error);
        reject(error);
    });
}

// 错误处理辅助函数
function handleRequestError(resourcePath, reject) {
    return (error) => {
        log(1, `获取资源时发生错误: ${resourcePath}`, error);
        reject(error);
    };
}

// 处理下载队列（已移除本地路径查找逻辑）
function processDownloadQueue() {
    if (downloadQueue.length === 0 || activeDownloads >= config.maxConcurrentDownloads) {
        return;
    }
    
    const { resourcePath, resolve, reject } = downloadQueue.shift();
    activeDownloads++;
    
    downloadFromOfficial(resourcePath)
        .then(result => {
            resolve(result);
        })
        .catch(error => {
            reject(error); // 直接拒绝，不再尝试本地路径查找
        })
        .finally(() => {
            activeDownloads--;
            processDownloadQueue(); // 处理下一个下载任务
        });
}

// 检查目录中是否有对应的config.json文件并提取hash值
function findConfigHashInDirectory(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) {
            return null;
        }
        
        const files = fs.readdirSync(dirPath);
        const configFile = files.find(file => file.startsWith('config.') && file.endsWith('.json'));
        
        if (configFile) {
            // 提取config文件名中的hash值
            const hashMatch = configFile.match(/config\.(.*?)\.json/);
            return hashMatch ? hashMatch[1] : null;
        }
        
        return null;
    } catch (error) {
        log(2, `查找config文件时出错: ${dirPath}`, error);
        return null;
    }
}

// 自动生成JS文件
function generateJSFile(resourcePath) {
    return new Promise((resolve, reject) => {
        try {
            // 检查是否是JS文件
            if (path.extname(resourcePath) !== '.js') {
                reject(new Error('不是JS文件，无法自动生成'));
                return;
            }
            
            // 获取文件所在目录
            const dirPath = path.dirname(path.join(config.localAssetsPath, resourcePath));
            // 查找同目录下的config.json文件并提取hash值
            const hashValue = findConfigHashInDirectory(dirPath);
            
            if (!hashValue) {
                reject(new Error('在目录中未找到对应的config.json文件'));
                return;
            }
            
            // 构建目标文件路径
            const targetFileName = `index.${hashValue}.js`;
            const targetFilePath = path.join(dirPath, targetFileName);
            
            // 确保目录存在
            if (!ensureDirectoryExists(targetFilePath)) {
                reject(new Error('无法创建目标目录'));
                return;
            }
            
            // 写入通用JS内容
            fs.writeFileSync(targetFilePath, COMMON_JS_CONTENT);
            log(3, `自动生成JS文件: ${targetFilePath}`);
            resolve(targetFilePath);
        } catch (error) {
            log(1, `生成JS文件时出错: ${resourcePath}`, error);
            reject(error);
        }
    });
}

// 添加下载任务到队列
function queueDownload(resourcePath) {
    return new Promise((resolve, reject) => {
        downloadQueue.push({ resourcePath, resolve, reject });
        processDownloadQueue();
    });
}

// 处理HTTP请求
function handleRequest(req, res) {
    let reqUrl = url.parse(req.url).pathname;
    
    // 处理根路径请求
    if (reqUrl === '/') {
        reqUrl = '/index.html';
    }
    
    // 检查是否是remote或assets路径请求
    let isRemotePath = false;
    let resourcePath = reqUrl.substring(1); // 去掉开头的斜杠
    let localFilePath;
    
    // 如果请求路径以remote开头，则映射到assets文件夹
    if (resourcePath.startsWith('remote/')) {
        isRemotePath = true;
        // 去掉remote/前缀
        resourcePath = resourcePath.substring(7);
        localFilePath = path.join(config.localAssetsPath, resourcePath);
    } 
    // 如果请求路径以assets开头，也视为需要自动下载的资源
    else if (resourcePath.startsWith('assets/')) {
        isRemotePath = true;
        // 去掉assets/前缀，因为本地已经在assets目录下
        resourcePath = resourcePath.substring(7);
        localFilePath = path.join(config.localAssetsPath, resourcePath);
    }
    else {
        // 普通路径请求，使用localResourceBase
        localFilePath = path.join(config.localResourceBase, resourcePath);
    }
    
    log(4, `收到请求: ${reqUrl}`);
    log(4, `映射到本地文件: ${localFilePath}`);
    
    // 检查文件是否存在
    fs.exists(localFilePath, (exists) => {
        if (exists) {
            // 文件存在，直接提供
            serveFile(localFilePath, res);
        } else if (config.enableAutoDownload && isRemotePath) {
            // remote路径的文件不存在，尝试从官网下载
            log(3, `Remote资源不存在，尝试从官网下载: ${resourcePath}`);
            
            queueDownload(resourcePath)
                .then(() => {
                    // 下载成功后提供文件
                    serveFile(localFilePath, res);
                })
                .catch((error) => {
                    log(2, `官网下载失败，尝试自动生成JS文件: ${resourcePath}`);
                    // 如果是JS文件，尝试自动生成
                    if (path.extname(resourcePath) === '.js') {
                        generateJSFile(resourcePath)
                            .then((generatedFilePath) => {
                                // 生成成功后提供文件
                                serveFile(generatedFilePath, res);
                            })
                            .catch((genError) => {
                                log(2, `无法提供remote资源且无法自动生成: ${reqUrl}`, genError);
                                res.writeHead(404, { 'Content-Type': 'text/plain' });
                                res.end('Remote资源不存在且无法从官网下载或自动生成');
                            });
                    } else {
                        log(2, `无法提供remote资源: ${reqUrl}`, error);
                        res.writeHead(404, { 'Content-Type': 'text/plain' });
                        res.end('Remote资源不存在且无法从官网下载');
                    }
                });
        } else {
            // 文件不存在且未启用自动下载，或者不是remote路径
            log(2, `资源不存在: ${reqUrl}`);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('资源不存在');
        }
    });
}

// 提供文件
function serveFile(filePath, res) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            log(1, `读取文件失败: ${filePath}`, err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('服务器内部错误');
            return;
        }
        
        // 设置MIME类型
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.wav': 'audio/wav',
            '.mp4': 'video/mp4',
            '.woff': 'application/font-woff',
            '.ttf': 'application/font-ttf',
            '.eot': 'application/vnd.ms-fontobject',
            '.otf': 'application/font-otf',
            '.wasm': 'application/wasm'
        };
        
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
        log(4, `成功提供文件: ${filePath}`);
    });
}

// 启动服务器
function startServer() {
    const server = http.createServer(handleRequest);
    
    // 确保assets目录存在
    if (!fs.existsSync(config.localAssetsPath)) {
        try {
            fs.mkdirSync(config.localAssetsPath, { recursive: true });
            log(3, `创建assets目录: ${config.localAssetsPath}`);
        } catch (error) {
            log(1, `无法创建assets目录: ${config.localAssetsPath}`, error);
        }
    }
    
    server.listen(config.port, () => {
        log(3, `服务器已启动，监听端口 ${config.port}`);
        log(3, `请访问 http://localhost:${config.port} 来运行游戏`);
        log(3, `Remote资源缺失时将自动从 ${config.officialResourceBase} 下载`);
        log(3, `Remote资源将保存到本地: ${path.resolve(config.localAssetsPath)}`);
    });
    
    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            log(1, `端口 ${config.port} 已被占用，请尝试其他端口或关闭占用该端口的程序`);
        } else {
            log(1, '服务器启动失败', error);
        }
    });
}

// 主程序入口
function main() {
    log(3, '启动自动资源下载服务器...');
    log(3, `本地资源目录: ${config.localResourceBase}`);
    
    startServer();
    
    // 优雅关闭
    process.on('SIGINT', () => {
        log(3, '正在关闭服务器...');
        log(3, `本次会话共缓存了 ${notFoundCache.size} 个不存在的资源`);
        process.exit(0);
    });
}

// 运行主程序
main();