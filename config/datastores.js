/**
 * Datastores
 * (sails.config.datastores)
 *
 * A set of datastore configurations which tell Sails where to fetch or save
 * data when you execute built-in model methods like `.find()` and `.create()`.
 *
 *  > This file is mainly useful for configuring your development database,
 *  > as well as any additional one-off databases used by individual models.
 *  > Ready to go live?  Head towards `config/env/production.js`.
 *
 * For more information on configuring datastores, check out:
 * https://sailsjs.com/config/datastores
 */

module.exports.datastores = {


    /***************************************************************************
    *                                                                          *
    * Your app's default datastore.                                            *
    *                                                                          *
    * Sails apps read and write to local disk by default, using a built-in     *
    * database adapter called `sails-disk`.  This feature is purely for        *
    * convenience during development; since `sails-disk` is not designed for   *
    * use in a production environment.                                         *
    *                                                                          *
    * To use a different db _in development_, follow the directions below.     *
    * Otherwise, just leave the default datastore as-is, with no `adapter`.    *
    *                                                                          *
    * (For production configuration, see `config/env/production.js`.)          *
    *                                                                          *
    ***************************************************************************/

    MySQLServer: {

        adapter: 'sails-mysql',
        // host: 'YOUR_MYSQL_SERVER_HOSTNAME_OR_IP_ADDRESS',
        // user: 'YOUR_MYSQL_USER',
        // password: 'YOUR_MYSQL_PASSWORD',
        // database: 'YOUR_MYSQL_DB'
    },


};
