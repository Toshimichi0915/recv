import AWS from "aws-sdk"

const db = new AWS.DynamoDB.DocumentClient()
const tableName = process.env.TABLE_NAME

export async function get(event) {

  console.debug(JSON.stringify(event))

  const destination = event.queryStringParameters.q

  const body = JSON.stringify((await db.query({
    TableName: tableName,
    ExpressionAttributeValues: {
      ":d": destination
    },
    KeyConditionExpression: "destination = :d"
  }).promise()).Items)

  console.debug(body)

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json"
    },
    body: body
  }
}

export async function handler(event) {

  console.debug(JSON.stringify(event))

  const operations = []

  for (const record of event.Records) {
    const sns = JSON.parse(record.Sns.Message)
    const source = sns.mail.source
    const destination = sns.mail.destination[0]
    const from = sns.mail.commonHeaders.from
    const subject = sns.mail.commonHeaders.subject
    const createdAt = Math.floor(Date.now() / 1000)

    const array = Buffer.from(sns.content, "base64")
      .toString()
      .split(/(?:\r?\n){2}/)

    let content
    if (array.length > 1) {
      content = array
        .slice(1)
        .join("\n")
        .replace(/\r?\n/g, "\n")
    } else {
      content = ""
    }

    console.debug(`
    source: ${source}
    destination: ${destination}
    from: ${from}
    subject: ${subject}
    content: ${content}`)

    operations.push(db.put({
      TableName: tableName,
      Item: {
        source, destination, from, subject, content, createdAt, expiredAt: createdAt + 3600
      }
    }).promise())
  }

  await Promise.all(operations)
}
