'use strict';

var constants       = require('../../../../testConstants');
var activityPage    = require('../../../pages/activityPage');
var projectListPage = require('../../../pages/projectsPage');
var projectPage     = require('../../../pages/projectPage');
var questionPage    = require('../../../pages/questionPage');
var textPage        = require('../../../pages/textPage');
var loginPage       = require('../../../pages/loginPage');


// Script of actions to perform which will then be verified on the activity feed.
// Currently, this list assumes test normal user has the role permissions for the actions
// scope options:  {'answers', 'comments'}
// action options: {'add', 'addToLastAnswer', 'edit', 'upvote', 'archive'}
// value: normally free text.  Can be an integer when used as 0-based index into the answers.list
//        If value is left blank, then perform the action on the last item
var script = [
	
	// These actions are performed by both normal user and manager user
	{scope: 'answers',   action: 'add',              value: 'Beethoven was the speaker.'},
	{scope: 'comments',  action: 'addToLastAnswer',  value: 'This is an original comment.'},
	{scope: 'comments',  action: 'edit',             value: 'This is an edited comment for the E2E test.'},
	{scope: 'answers',   action: 'edit',             value: 'Mozart was also the speaker.'},
	{scope: 'answers',   action: 'upvote',           value: 1},
	{scope: 'answers',   action: 'downvote',         value: 1},
	/* 
	// archiving a comment/answer at a specific answer works, but the verification process doesn't
	// know which indices were removed.
	// Also, normal user isn't guaranteed to have permissions to archive answer at index 1
	//{scope: 'comments',  action: 'archive',          value: 1},
	//{scope: 'answers',   action: 'archive',          value: 1},
	*/
	{scope: 'comments',  action: 'archive',          value: ''},
	{scope: 'answers',   action: 'archive',          value: ''},
	
	// TODO: These actions are performed by only manager user   2014-05 DDW */
	{scope: 'texts',     action: 'add',              value: constants.testText3Title},
	//{scope: 'questions', action: 'add',             value: 'Some question to add'},
	//{scope: 'users',     action: 'add',             value: 'Some Username to add to project'},
	//*/
];


// Array of test usernames to test Activity page with different roles
var usernames = [constants.memberUsername,
                 constants.managerUsername
				 ];

// Utility function to determine if the current user will have the role permissions to do the scope/action
var isAllowed = function(scope, username) {
	// normal user doesn't have permissions for these scopes:
	if ( (username == constants.memberUsername) &&
	     ((scope == 'texts') || (scope == 'questions') || (scope == 'users')) ) {
		return false;
	};

	// Everything else is allowed
	return true;
};

describe('Activity Page E2E Test', function() {
	 
	// Run the Activity E2E as each test user
	usernames.forEach(function(expectedUsername){

		// Perform activity E2E tests according to the different roles
		describe('Running as: ' + expectedUsername, function() {

			it('Logging in', function() {
				// Login before test to ensure proper role
				if (expectedUsername == constants.memberUsername) {
					loginPage.loginAsUser();
				} else if (expectedUsername == constants.managerUsername) {
					loginPage.loginAsManager();
				};
			});

			it('Performing a script of actions', function() {
				// Navigate to the Test Project -> Text -> Question
				projectListPage.get();
				projectListPage.clickOnProject(constants.testProjectName);
				projectPage.clickOnText(constants.testText1Title);
				textPage.clickOnQuestion(constants.testText1Question1Title);

				// Evaluate the script actions
				for (var i=0; i<script.length; i++) {
					// Append timestamp for answer/comment add/edit actions
					if ( ((script[i].scope == 'answers') || (script[i].scope == 'comments')) && 
						 ((script[i].action == 'add') || (script[i].action == 'edit')) ) {
						script[i].value = script[i].value + Math.floor(new Date().getTime() / 1000);
					};
					
					// Skip if user doesn't have role permissions for the scope/action
					if (!isAllowed(script[i].scope, expectedUsername)) {
						continue;
					};

					switch (script[i].scope) {
						case 'texts' :
							// Navigate back to Project Page
							browser.navigate().back();
							browser.navigate().back();
							projectPage.addNewText(script[i].value, projectPage.testData);
							
							// Return back to Question Page for rest of test
							browser.navigate().forward();
							browser.navigate().forward();
						break;
						case 'questions' :
							textPage.clickOnQuestion(constants.testText1Question1Title);
						break;
						case 'users' :
						break;
						default :
							// Navigate Text -> Question -> then perform action
							questionPage[script[i].scope][script[i].action](script[i].value);
					};
				};
			});

			it ('Verify actions appear on the activity feed', function() {
				// Now check the activity feed.  Current items are at the head
				// of the activity feed so traverse the script in reverse order
				activityPage.get();
				var scriptIndex = script.length - 1;
				var activityIndex = 0;
				var activityText = '';

				// Print everything in the activity list for debugging purposes
				//activityPage.printActivitiesNames();

				while (scriptIndex >= 0) {
					// Skip verifying the following actions/scope because they don't appear in the activity feed
					// or because normal user doesn't have role permissions to do them
					if ( (script[scriptIndex].action == 'archive') || 
					     (script[scriptIndex].action == 'downvote') || 
						 (!isAllowed(script[scriptIndex].scope, expectedUsername)) ) {
						scriptIndex--;
						continue;
					}

					// Expect some combinations of username, script scope, action, and value
					// to appear in the activity feed
					
					// Normally, the activity page lists the username as performing the action.
					// The exception is Project name adding texts
					activityText = activityPage.getActivityText(activityIndex);
					if (script[scriptIndex].scope != 'texts') {
						expect(activityText).toContain(expectedUsername);
					} else {
						expect(activityText).toContain(constants.testProjectName);
					};
					
					// Truncate the ending 's' of the Scope string to partially match strings with different scope tenses
					var expectedString = script[scriptIndex].scope;
					expectedString = expectedString.replace(/s$/gi, '');
					if (expectedString != 'text') {
						expect(activityText).toContain(expectedString);
					};
					
					// Verify actions
					if (script[scriptIndex].action == 'edit') {
						expect(activityText).toContain('updated');
					} else if (script[scriptIndex].action == 'upvote') {
						expect(activityText).toContain('+1\'d')
					};
					
					// Verify values
					if (typeof script[scriptIndex].value == 'string') {
						expect(activityText).toContain(script[scriptIndex].value);
					};

					scriptIndex--;
					activityIndex++;
				};
			});
			
			it ('Verify filters work on the activity page', function() {
				// Additional tests to verify activity page filtering
				var activityText = '';

				activityPage.get();
				
				// Expect the last activity to be performed by admin
				activityPage.getLength().then(function(len) {
					activityText = activityPage.getActivityText(len - 1);
					expect(activityText).toContain('admin');
				});
				
				// Show only my activity
				activityPage.clickOnShowOnlyMyActivity();
				
				// Expect the last activity to be performed by current username
				// If scope isn't texts
				activityPage.getLength().then(function(len) {
					activityText = activityPage.getActivityText(len - 1);
					if (script[script.length - 1].scope != 'texts') {
						expect(activityText).toContain(expectedUsername);
					};
				});
				
				// Show all activity
				activityPage.clickOnAllActivity();
				
				// Expect the last activity to be performed by admin
				activityPage.getLength().then(function(len) {
					activityText = activityPage.getActivityText(len - 1);
					expect(activityText).toContain('admin');
				});

				//browser.debugger();
			
			});
		});
	});
});
