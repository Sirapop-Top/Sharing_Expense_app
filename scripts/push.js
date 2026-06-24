const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function runCommand(command) {
  try {
    console.log(`> ${command}`);
    return execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`❌ Error executing command: ${command}`);
    return null;
  }
}

function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log("==================================================");
  console.log("🚀 GitHub Push Utility for FairShare App");
  console.log("==================================================");

  // 1. Check if git is initialized
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    console.log("✓ Git repository detected.");
  } catch (e) {
    console.log("⚠️ Git repository not found. Initializing...");
    runCommand('git init');
  }

  // 2. Git status overview
  console.log("\nStaging files...");
  runCommand('git add .');

  // 3. Ask for commit message
  const defaultCommit = "feat: initialize 2-person expense sharing web app with Google Sheets backend";
  const commitInput = await askQuestion(`💬 Enter commit message [Default: "${defaultCommit}"]: `);
  const commitMessage = commitInput.trim() || defaultCommit;

  try {
    console.log("\nCommitting changes...");
    // Run commit using child_process with message
    execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
  } catch (error) {
    console.log("⚠️ Nothing to commit or commit failed. Moving forward.");
  }

  // 4. Ask for GitHub Remote URL
  const remoteUrl = await askQuestion("\n🌐 Enter GitHub Remote URL (e.g., https://github.com/user/repo.git) [Leave empty to commit locally only]: ");
  
  if (remoteUrl.trim()) {
    const cleanUrl = remoteUrl.trim();
    
    // Set branch name
    runCommand('git branch -M main');
    
    // Check if origin remote already exists
    let hasRemote = false;
    try {
      execSync('git remote get-url origin', { stdio: 'ignore' });
      hasRemote = true;
    } catch (e) {
      hasRemote = false;
    }

    if (hasRemote) {
      console.log("✓ Remote 'origin' already exists. Updating remote URL...");
      runCommand(`git remote set-url origin ${cleanUrl}`);
    } else {
      console.log("✓ Adding remote 'origin'...");
      runCommand(`git remote add origin ${cleanUrl}`);
    }

    console.log("\nPushing code to GitHub main branch...");
    const pushed = runCommand('git push -u origin main');
    
    if (pushed !== null) {
      console.log("\n🎉 Pushed successfully to GitHub repository!");
    } else {
      console.log("\n❌ Push failed. Please double check that you have created the empty repository on GitHub and have correct access permissions.");
    }
  } else {
    console.log("\n✓ Committed locally. Skipping GitHub push.");
  }

  rl.close();
}

main();
