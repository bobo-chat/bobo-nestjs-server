### socket 通信规范


* [demo](../ws/client.html)

##### 1.首次连接

> 首次连接，需要传递参数，server判断请求合法

| header      | desc | example |
| ----------- | ---- | ------- |
| X-Pub-Key   |      |         |
| X-Sign      |      |         |
| X-Time      |      |         |
| X-Data-Hash |      |         |


##### 2.通信

| topic  | data      |
| ------ | --------- |
| events | {type: 0,data: {}} |

* type根据具体的业务类型进行区分




##### 3 集成步骤
* https://firebase.google.com/docs/cloud-messaging/send-message?hl=zh&authuser=0
* npm install firebase-admin --save
* https://rnfirebase.io/
```typescript
import { initializeApp } from 'firebase-admin/app';
const app = initializeApp();
FIREBASE_CONFIG
```
