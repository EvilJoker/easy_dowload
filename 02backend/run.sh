#!/bin/bash

BASE_PATH=$(cd $(dirname $0); pwd)
echo $BASE_PATH
API_CLIENT_PATH=$BASE_PATH/../01frontend/src/shared

# 生成 api-client.js

echo "cp $API_CLIENT_PATH/api-client.js $BASE_PATH/static/"
cp $API_CLIENT_PATH/api-client.js $BASE_PATH/static/

# 启动服务
uv run python -m src.main