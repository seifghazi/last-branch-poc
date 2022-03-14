const express = require("express");
const bodyParser = require("body-parser");
const git = require("nodegit");
const { exec } = require("child_process");
const app = express();
const port = 3000;

// parses incoming request body to JSON for easier handling
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/pullRequest", (req, res) => {
  // If PR was merged, process the webhook
  if (req.body.action === "closed") {
    const mergedBranchName = req.body.pull_request.base.ref;

    git.Repository.open("./sample-jsons")
      .then(async (repo) => {
        // fetch latest changes
        await repo.fetch("origin", {
          callbacks: {
            credentials: function (url, userName) {
              return git.Cred.sshKeyNew(
                userName,
                "/Users/sghazi/.ssh/id_ed25519.pub",
                "/Users/sghazi/.ssh/id_ed25519",
                ""
              );
            },
          },
        });

        // Checkout commit that contains the recently merged changes
        // get JSON file
        const mergeCommitRef = req.body.pull_request.base.ref;
        let commit = await repo.getBranchCommit(mergeCommitRef);
        // console.log(commit.sha());
        let entry = await commit.getEntry("topics.json");
        let json = await entry.getBlob();
        console.log(json.toString());
        json = JSON.parse(json.toString());

        // check if 'future' release branch exist
        let branchNames = await repo.getReferenceNames(git.Reference.TYPE.ALL);

        branchNames = Array.from(new Set(
          branchNames
            .filter((branchName) => branchName.includes("remotes"))
            .map((branchName) => branchName.split("/")[3])
        ));

        console.log(branchNames);

        currentBranchIndex = branchNames.indexOf(mergeCommitRef);
        console.log('current branch', mergeCommitRef);
        console.log(currentBranchIndex);
        if (currentBranchIndex !== branchNames.length - 1) {
            // there exists a future release branch - checkout that branch, get union of jsons, create PR
            let futureBranch = await repo.getBranchCommit(branchNames[currentBranchIndex + 1]);
            let entry = await futureBranch.getEntry("topics.json");
            let blob = await entry.getBlob();
            console.log("New branch JSON", blob.toString());
        }

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

var options = {
  callbacks: {
    credentials: function (url, userName) {
      return git.Cred.sshKeyFromAgent(userName);
    },
    certificateCheck: function () {
      return 0;
    },
  },
};
