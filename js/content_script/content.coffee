### global chrome ###
###
 Script that is embedded on each user page
 Listens messages from translation module and renders popup
 with translated text
###


View = require('./view.coffee');

content = new View()