FROM node:22
RUN apt-get update && apt-get -y install sqlite3 libsqlite3-dev && mkdir -p /tmp/baseapp
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --production --silent && mv node_modules ../
COPY . .
EXPOSE 4000
RUN chown -R node:node /usr/src/app
USER node
CMD ["npm", "start"]