Write-Host "Warming up shpole.com"
curl -s https://shpole.com --output nul
Write-Host "Removing local database"
Remove-Item -Force data/shpole.db
Write-Host "Getting production database from shpole.com"
flyctl ssh sftp get /app/data/shpole.db data/shpole.db --app shpole
Write-Host "Done"
