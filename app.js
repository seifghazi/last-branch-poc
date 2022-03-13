const express = require("express");
const bodyParser = require("body-parser");
const git = require("nodegit");
const app = express();
const port = 3000;

// parses incoming request body to JSON for easier handling
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/", (req, res) => {
  console.log(req.body);
  // If PR was merged, process the webhook
  if (req.body.action === "closed") {
    const mergedBranchName = req.body.pull_request.base.ref;
    
    git.Repository.open("./sample-jsons")
      .then(async (repo) => {
        console.log("Using " + repo.path());
        let currentBranch = await repo.getCurrentBranch();
        let currentCheckedOutBranchName = currentBranch.shorthand();
        
        // If branch that is checked out now is the releaseBranch that just merged, all good. 
        // Otherwise checkout the newly merged branch
        if (currentCheckedOutBranchName !== mergedBranchName) {
            await repo.checkoutBranch(mergedBranchName);
        }

        currentBranch = await repo.getCurrentBranch();
        currentCheckedOutBranchName = currentBranch.shorthand();

        console.log(currentCheckedOutBranchName);
      })
      .catch((err) => {
        console.log(err);
      });
  }
  res.send("success");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});
