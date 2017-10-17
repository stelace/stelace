# Crons that must be added to crontab

# http://www.thegeekstuff.com/2009/06/15-practical-crontab-examples/

# Example
* * * * * cd /path/to/project && /usr/local/bin/node crons/example.js >> cron.log 2>&1

# Send reminder emails every day at 8:00 AM and at 8:00 PM
0 8,20 * * * cd /path/to/project && /usr/local/bin/node crons/sendReminderEmails.js >> cron.log 2>&1

# Send monitoring emails every day at 8:00 AM
0 8 * * * cd /path/to/project && /usr/local/bin/node crons/sendMonitoringEmails.js >> cron.log 2>&1

# Send email for gamification steps every day at 8:10 AM
10 8 * * * cd /path/to/project && /usr/local/bin/node crons/sendGamificationStepsEmail.js >> cron.log 2>&1

# Sync odoo bookings every monday at 8:30 AM
30 8 * * 1 cd /path/to/project && /usr/local/bin/node crons/syncOdooBookings.js >> cron.log 2>&1

# Set odoo account invoice move ref every monday at 8:40 AM
40 8 * * 1 cd /path/to/project && /usr/local/bin/node crons/setOdooAccountInvoiceMoveRef.js >> cron.log 2>&1

# Set gamification points at 2:15 AM
15 2 * * * cd /path/to/project && /usr/local/bin/node crons/setGamificationPoints.js >> cron.log 2>&1

# Cancel expired bookings at 3:00 AM
0 3 * * * cd /path/to/project && /usr/local/bin/node crons/cancelExpiredBookings.js >> cron.log 2>&1

# Cancel bookings payment at 3:10 AM
10 3 * * * cd /path/to/project && /usr/local/bin/node crons/cancelBookingsPayment.js >> cron.log 2>&1

# Run bookings deposit at 3:20 AM
20 3 * * * cd /path/to/project && /usr/local/bin/node crons/runBookingsDeposit.js >> cron.log 2>&1

# Payin the payment at 3:30 AM
30 3 * * * cd /path/to/project && /usr/local/bin/node crons/payinPayment.js >> cron.log 2>&1

# Transfer the payment at 3:40 AM
40 3 * * * cd /path/to/project && /usr/local/bin/node crons/transferPayment.js >> cron.log 2>&1

# Withdraw the payment at 3:50 AM
50 3 * * * cd /path/to/project && /usr/local/bin/node crons/withdrawPayment.js >> cron.log 2>&1

# Synchronize elasticsearch at 4:00 AM
0 4 * * * cd /path/to/project && /usr/local/bin/node crons/syncElasticsearch.js >> cron.log 2>&1

# Update items pause state at 0:15 AM
15 0 * * * cd /path/to/project && /usr/local/bin/node crons/itemPause.js >> cron.log 2>&1

# Update items stats at 0:30 AM
30 0 * * * cd /path/to/project && /usr/local/bin/node crons/itemStats.js >> cron.log 2>&1
