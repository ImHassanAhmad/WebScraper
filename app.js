const puppeteer = require("puppeteer");
const XLSX = require("xlsx");

async function navigateWithRetry(page, url, maxAttempts) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      await page.goto(url, { timeout: 30000 });
      break; // Successful navigation, exit the loop
    } catch (error) {
      console.error(`Navigation attempt ${attempt + 1} failed:`, error);
      attempt++;
    }
  }
}

async function run() {
  let href = "https://www.gk-jobs.com/category/jobs-in-punjab/";
  let sheet = [
    [
      "Title",
      "Job description",
      "Vacancy",
      "Posted",
      "Deadline",
      "Link",
      "Address",
      "Salary",
    ],
  ];
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: false,
    userDataDir: "./tmp",
  });

  const page = await browser.newPage();
  await page.goto(href);

  let elementsByClassname = await page.$$eval("a.more-link", (links) =>
    links.map((link) => link.href)
  );

  for (let i = 0; i < elementsByClassname.length; i++) {
    const element = elementsByClassname[i];
    await navigateWithRetry(page, element, 3);

    //---------------------------EXTRACT DATA--------------------//

    const title = await page.title();
    const url = await page.url();

    const description = await page.$eval(
      "#the-post > div.entry-content.entry.clearfix",
      (div) => {
        const getTextRecursive = (node) => {
          let text = "";

          // Iterate over child nodes
          for (const childNode of node.childNodes) {
            // Handle different node types
            if (childNode.nodeType === Node.TEXT_NODE) {
              text += childNode.textContent;
            } else if (childNode.nodeType === Node.ELEMENT_NODE) {
              text += getTextRecursive(childNode);
            }
          }

          return text;
        };

        return getTextRecursive(div);
      }
    );

    const tableValues = await page.$$eval("table tr", (rows) => {
      return rows.map((row) => {
        const cells = Array.from(row.querySelectorAll("td, th"));
        return cells.map((cell) => cell.textContent.trim());
      });
    });
    let posted = "";
    let deadline = "";
    let vacany = "";
    tableValues.forEach((elm) => {
      if (elm[0].includes("Posted on")) posted = elm[1];
      else if (elm[0].includes("Last Date")) deadline = elm[1];
      else if (elm[0].includes("No of Posts") || elm[0].includes("Vacancies"))
        vacany = elm[1];
    });

    //---------------------------Write to XLSX-----------------//

    sheet.push([title, description, vacany, posted, deadline, url, "", ""]);
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(sheet);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet 1");
    const filePath = "Jobs.xlsx";
    XLSX.writeFile(workbook, filePath);

    console.log(
      "-----------------------------------------------------------------------------------"
    );
    console.log("PAGE", href);
    console.log("JOB", i + 1, elementsByClassname.length, title);
    console.log(
      "-----------------------------------------------------------------------------------"
    );
    await navigateWithRetry(page, href, 3);

    if (i == elementsByClassname.length - 1) {
      console.log("LAST PAGE");
      href = await page.$eval("span.last-page > a", (link) => link.href); // Check if the span with class .last-page exists

      if (href) {
        await navigateWithRetry(page, href, 3);
        i = -1;
      }
    }
    elementsByClassname = await page.$$eval("a.more-link", (links) =>
      links.map((link) => link.href)
    );
  }

  await browser.close();
}

run().catch((error) => console.error(error));
