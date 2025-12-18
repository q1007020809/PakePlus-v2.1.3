@echo off
setlocal enabledelayedexpansion

:: 设置参数
set PORT=3003
set WAIT_SECONDS=3600000
set MINute=60

echo ==============================================
echo 服务器自动重启脚本 (使用 serve)
echo 端口: %PORT%
echo 重启间隔: 每小时（%WAIT_SECONDS%秒）
echo 按 Ctrl+C 然后输入 Y 可退出脚本
echo ==============================================
echo.

:restart
echo [%time%] 正在启动服务器，端口%PORT%...
:: 关键配置：将所有请求重定向到 index.html
serve -s -l %PORT%

:: 检查程序退出状态
if %errorlevel% equ 0 (
    echo [%time%] 服务器正常停止
) else (
    echo [%time%] 服务器异常停止，错误码: %errorlevel%
)

:: 倒计时显示
echo 等待1小时后自动重启...
set /a remaining=%WAIT_SECONDS%

:countdown
if %remaining% gtr 0 (
    set /a minutes=remaining / minute
    set /a seconds=remaining %% minute
    if !minutes! gtr 0 (
        echo 剩余 !minutes! 分 !seconds! 秒...
        timeout /t %minute% /nobreak >nul
        set /a remaining=remaining - minute
    ) else (
        echo 剩余 !remaining! 秒...
        timeout /t 1 /nobreak >nul
        set /a remaining=remaining - 1
    )
    goto countdown
)

echo.
goto restart