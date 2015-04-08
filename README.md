docker-browser
==============

该项目是负责完成创建容器的功能
安装步骤
```
npm install
cd node_modules
git clone git@ali.peilong.me:coderun/docker-run.git
cd docker-run
npm install
cd ../
rm -rf docker-browser-console
git clone git@ali.peilong.me:coderun/docker-browser-console.git
cd docker-browser-console
npm install
cd node_modules
rm -rf docker-run
git clone git@ali.peilong.me:coderun/docker-run.git
cd docker-run
npm install
```
run command
node bin.js 127.0.0.1:6367(this is redis addr)

