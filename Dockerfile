FROM node:16

WORKDIR /app
COPY Gruntfile.js *.json ./
RUN npm install && npm run grunt
COPY . ./
CMD [ "npm", "start" ]
