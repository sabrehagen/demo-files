angular.module('views.preview', [
    'views.preview.files',
    'views.preview.code',
    'views.preview.pcb',
    'views.preview.pdf',
]);
angular.module('views.preview').

config(function ($stateProvider) {
    $stateProvider.
    state('app.preview', {
        url: '/preview/:projectStub/:path?rev&edit',
        sticky: true,
        resolve: {
            project: function($stateParams, EntityService, $timeout, $state){
                return EntityService.get('project', $stateParams.projectStub, 'sm').
                catch(function(error){
                    $timeout(function(){
                        $state.go('app.404', null, {location: false});
                    })
                    return error
                })
            },
            previousState: function ($state) {
                return {
                    name: $state.current.name,
                    params: $state.params,
                };
            },
            fileMeta: function (SyncService, $stateParams) {
                return SyncService.metadata($stateParams.projectStub, $stateParams.path, {revision: $stateParams.rev}).then(function(response){
                    return response.data;
                })
            },
            userPermissions: function(userdata, project, PermissionsService, $stateParams){
                return PermissionsService.permissionRedirect({
                    userdata : userdata,
                    entity   : project,
                    level    : project.permissions.projectType == 'public' ? 'public' : 'viewer',
                    secret   : $stateParams.secret
                })
            },
        },
        templateUrl: 'app/views/preview/preview.html',
        controller: function (userPermissions, project, fileMeta, previousState, $scope, $state, $timeout, $stateParams, SyncService, SyncUtilService, $location) {
            $scope.userPermissions = userPermissions;
            $scope.path            = $stateParams.path;
            $scope.project         = project;
            $scope.fileMeta        = fileMeta;

            $scope.previewer = {};
            $scope.previewer.edit = ($scope.userPermissions.isMin('collaborator') && $stateParams.edit == 'true') ? true : false;

            // Functions
            $scope.closePreview   = closePreview; //function(path, projectStub, type);
            $scope.revisionChange = revisionChange; //function(revison);
            $scope.saveFile = saveFile; //function(revison);
            $scope.saveAndExit = saveAndExit; //function(revison);


            if($scope.fileMeta.provider == 'drive'){
                SyncService.getPath($scope.path, $scope.project.stub).then(function(response){
                    response.shift(0);
                    $scope.breadCrumbs = response
                })
            }
            else{
                $scope.breadCrumbs = SyncUtilService.getCrumbs($scope.path);
            }


            $scope.tabs = [
//                {
//                    label: 'Timeline',
//                    clickFn: function(){
//                        $scope.activeTab = this.label;
//                    }
//                },
                {
                    label: 'Meta',
                    clickFn: function(){
                        $scope.activeTab = this.label;
                    }
                }
            ];
            $scope.activeTab = 'Meta';

            SyncService.revisions($scope.project.stub, $scope.path).then(function(revisions){
                $scope.revisions = revisions;
                var metaExtra = _.find(revisions, 'rev', $scope.fileMeta.rev);
                if(metaExtra){
                    $scope.fileMeta.revDecimal = metaExtra.revDecimal;
                }
            })

//            SyncService.getPath($scope.project.stub, $scope.path).then(function(response){
//                console.log(response);
//            })

            //////////////////////////////////

            function saveFile(){
                return SyncService.upload($scope.project.stub, $scope.path, {revision: $scope.fileMeta.rev}, $scope.previewer.fileData).then(function(response){
                    $scope.previewer.edit = false;
                    return response
                });
            }

            function saveAndExit(){
                $scope.savePending = true;
                return SyncService.upload($scope.project.stub, $scope.path, {revision: $scope.fileMeta.rev}, $scope.previewer.fileData).then(function(response){
                    closePreview()
//                    $scope.savePending = false;
                });
            }

            function revisionChange(revisionMeta){
                $scope.fileMeta = _.extend($scope.fileMeta, revisionMeta);
                $state.current.reloadOnSearch = false;
                $location.search('rev', revisionMeta.rev);
                $timeout(function () {
                    $state.current.reloadOnSearch = undefined;
                });
                if($scope.previewer.render){
                    $timeout($scope.previewer.render);
                }
            }

            function closePreview(){
                if(previousState.name && previousState.params){
                    $state.go(previousState.name, previousState.params)
                }
                else if($scope.breadCrumbs && $scope.breadCrumbs[$scope.breadCrumbs.length-2]){
                    $state.go('app.project.files', {
                        stub: project.stub,
                        path: $scope.breadCrumbs[$scope.breadCrumbs.length-2].path
                    })
                }
                else{
                    // If breadcrumbs is length 1
                    $state.go('app.project.files', {
                        stub: project.stub,
                        path: ''
                    })
                }
            }
        },
        menu: {
            main : [],
            more : []
        },
        layout: {
            size: 'md',
            hideOverflow: true,
            topBanner: false,
            horizontalMenu: false,
            smooch: false,
        },
        seo: function(resolve){
            return {
                title       : resolve.fileMeta.name + ' - ' + resolve.project.name,
            }
        }
    });
});
