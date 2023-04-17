FROM node:18

RUN npm install

EXPOSE 8080

CMD ["npm", "start"]
