docker-browser
==============

该项目是负责完成创建容器的功能
安装步骤
```
npm install
```
#API
创建镜像的tty
```
/user/{userid}/{imagename}/{tag}

```
查找镜像的实例
```
/findrunner/{imagename}
返回结果为
{
  image_id:镜像的名字 string,
  hosts:docker的主机名 string,
  status:状态 int 1表示正在pull镜像，2表示pull完成，3表示有事例在运行,
  status_msg:说明状态的字符串 string,
  instances:[
    {
        container_id:容器id string,
        port:容器暴露出来的端口 int
    }
  ]
}
```
创建镜像
```
/createrunner/{imagename}
返回的对象和上面的一样
```
run command
node bin.js -r 127.0.0.1:6367(this is redis addr) -dh docker2.peilong.me -dp 4243

