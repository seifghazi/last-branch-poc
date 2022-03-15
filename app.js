const express = require("express");
const bodyParser = require("body-parser");
const git = require("nodegit");
const merge = require("deepmerge");
const fs = require("fs");
const { getMaxListeners } = require("process");
const { sign } = require("crypto");
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
        const mergeCommitSha = req.body.pull_request.merge_commit_sha;
        const commit = await repo.getCommit(mergeCommitSha);

        console.log(commit.message());
        let recentlyMergedJSON = await extractJsonFromCommit(
          commit,
          "topics.json"
        );
        console.log(recentlyMergedJSON.topics["INGESTED.Example.Account"]);

        // check if 'future' release branch exist
        let branchNames = await repo.getReferenceNames(git.Reference.TYPE.ALL);

        console.log(branchNames);
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
          const futureBranchName = branchNames[currentBranchIndex + 1];
          let futureBranchCommit = await repo.getBranchCommit(futureBranchName);

          console.log(futureBranchName);
          console.log(futureBranchCommit.message());

          let newJSON = await extractJsonFromCommit(
            futureBranchCommit,
            "topics.json"
          );

          console.log(
            "future json",
            newJSON.topics["INGESTED.Example.Account"]
          );

          // perform union
          const overwriteMerge = (destinationArray, sourceArray, options) => sourceArray
          let unionJSON = merge(recentlyMergedJSON, newJSON, {
            arrayMerge: overwriteMerge
          });

          console.log(
            "union json",
            unionJSON.topics["INGESTED.Example.Account"]
          );

          // checkout temp branch that will be merged
          exec("git checkout release-May", { cwd: "./sample-jsons" });
          exec("git pull", { cwd: "./sample-jsons" });
          exec("git checkout -b branch-off-may", { cwd: "./sample-jsons" });
          // exec("git merge release-May", { cwd: "./sample-jsons" });
          fs.writeFileSync(
            "./sample-jsons/topics.json",
            JSON.stringify(unionJSON, null, "\t")
          );
          exec('git cm -am  "updated sample json from nodejs app"', {
            cwd: "./sample-jsons",
          });
          exec("git push -u origin branch-off-may", { cwd: "./sample-jsons" });

          // let tempBranch = await repo.checkoutBranch("refs/remotes/origin/branch-off-may");
          // let tempCommit = await repo.getBranchCommit("branch-off-may");
          // let index = await git.Merge.commits(repo, tempCommit, futureBranchCommit);

          // console.log(index.hasConflicts());

          // let oid = await index.writeTreeTo(repo);

          // let commitId = await repo.createCommit("refs/remotes/origin/branch-off-may", signature, signature, "From NODE BABY!", oid, [tempCommit, futureBranchCommit]);

          // console.log(commitId);

          // console.log('commit message :)', tempCommit.message());
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

let signature = git.Signature.now("Seif Ghazi", "seifghazi@gmail.com");
