const express = require("express");
const bodyParser = require("body-parser");
const git = require("nodegit");
const merge = require('deepmerge');
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
        const mergeCommitRef = req.body.pull_request.base.ref;
        const commit = await repo.getBranchCommit(mergeCommitRef);
        let recentlyMergedJSON = await extractJsonFromCommit(
          commit,
          "topics.json"
        );
        console.log(recentlyMergedJSON);

        // check if 'future' release branch exist
        let branchNames = await repo.getReferenceNames(git.Reference.TYPE.ALL);
        
        branchNames = Array.from(
            new Set(
                branchNames
                .filter((branchName) => branchName.includes("remotes"))
                .map((branchName) => branchName.split("/")[3])
                )
                );
                
                
        currentBranchIndex = branchNames.indexOf(mergeCommitRef);
        if (currentBranchIndex !== branchNames.length - 1) {
          // there exists a future release branch - checkout that branch, get union of jsons, create PR
          let futureBranchCommit = await repo.getBranchCommit(
            branchNames[currentBranchIndex + 1]
          );
          let newJSON = await extractJsonFromCommit(
            futureBranchCommit,
            "topics.json"
          );

          console.log("future json", newJSON);

          // perform union 
          let unionJSON = merge(recentlyMergedJSON, newJSON);

          console.log('union json', unionJSON.topics["INGESTED.Example.Customer"]);
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

// extractJsonFromCommit is a helper fn that given a commit and a json file name will fetch, parse, and return that json
const extractJsonFromCommit = async (commit, fileName) => {
  let entry = await commit.getEntry(fileName);
  let blob = await entry.getBlob();
  return JSON.parse(blob.toString());
};
