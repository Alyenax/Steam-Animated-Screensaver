// Native recording helper for the launch presentation. Not shipped in application packages.
#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <CoreMedia/CoreMedia.h>
#import <AVFoundation/AVFoundation.h>
#import <signal.h>

@interface Capture : NSObject <SCRecordingOutputDelegate, SCStreamDelegate, SCStreamOutput>
@property SCStream *stream;
@property SCRecordingOutput *output;
@property NSString *report;
@property double duration;
@property double epoch;
@property double sourceWidth;
@property double sourceHeight;
@property NSInteger frames;
@property double first;
@property double last;
@property double maxGap;
@end
@implementation Capture
- (void)stop { [self.stream stopCaptureWithCompletionHandler:^(NSError *error){if(error)fprintf(stderr,"Stop: %s\n",error.localizedDescription.UTF8String);}]; }
- (void)recordingOutputDidStartRecording:(SCRecordingOutput*)output {
 self.epoch=NSDate.date.timeIntervalSince1970;printf("RECORDING %.3f\n",self.epoch);fflush(stdout);
 if(self.duration>0)dispatch_after(dispatch_time(DISPATCH_TIME_NOW,(int64_t)(self.duration*NSEC_PER_SEC)),dispatch_get_main_queue(),^{[self stop];});
}
- (void)recordingOutput:(SCRecordingOutput*)output didFailWithError:(NSError*)error {fprintf(stderr,"Recording failed: %s\n",error.localizedDescription.UTF8String);exit(2);}
- (void)recordingOutputDidFinishRecording:(SCRecordingOutput*)output {
 NSDictionary *report=@{@"capture":@"ScreenCaptureKit window-only, native H.264, no audio",@"sourceWidth":@(self.sourceWidth),@"sourceHeight":@(self.sourceHeight),@"requestedMaxFps":@60,@"startEpoch":@(self.epoch),@"samples":@(self.frames),@"timestampSpan":@(self.last-self.first),@"largestSampleGap":@(self.maxGap),@"bytes":@(output.recordedFileSize),@"duration":@(CMTimeGetSeconds(output.recordedDuration))};
 [[NSJSONSerialization dataWithJSONObject:report options:NSJSONWritingPrettyPrinted error:nil] writeToFile:self.report atomically:YES];printf("FINISHED\n");fflush(stdout);exit(0);
}
- (void)stream:(SCStream*)stream didStopWithError:(NSError*)error {fprintf(stderr,"Stream: %s\n",error.localizedDescription.UTF8String);exit(3);}
- (void)stream:(SCStream*)stream didOutputSampleBuffer:(CMSampleBufferRef)sample ofType:(SCStreamOutputType)type {
 if(type!=SCStreamOutputTypeScreen||!CMSampleBufferIsValid(sample))return;
 NSArray *attachments=(__bridge NSArray*)CMSampleBufferGetSampleAttachmentsArray(sample,false);
 NSNumber *status=attachments.firstObject[SCStreamFrameInfoStatus];
 if(status.integerValue!=SCFrameStatusComplete)return;
 double t=CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sample));
 if(self.frames==0)self.first=t;else self.maxGap=MAX(self.maxGap,t-self.last);
 self.last=t;self.frames++;
}
@end
static Capture *capture;
int main(int argc,const char **argv){@autoreleasepool{
 [NSApplication sharedApplication];[NSApp setActivationPolicy:NSApplicationActivationPolicyProhibited];
 if(!CGPreflightScreenCaptureAccess()){fprintf(stderr,"Screen recording permission is not available.\n");return 4;}
 BOOL list=argc==2&&!strcmp(argv[1],"--list");
 if(!list&&argc<4){fprintf(stderr,"Usage: capture-window --list | WINDOW_ID OUTPUT.mp4 SECONDS (0 = wait for SIGINT)\n");return 1;}
 uint32_t wanted=list?0:(uint32_t)strtoul(argv[1],NULL,10);
 capture=[Capture new];
 if(!list){capture.report=[[NSString stringWithUTF8String:argv[2]] stringByAppendingString:@".json"];capture.duration=atof(argv[3]);}
 [SCShareableContent getShareableContentExcludingDesktopWindows:YES onScreenWindowsOnly:NO completionHandler:^(SCShareableContent *content,NSError *error){
  if(error){fprintf(stderr,"Windows: %s\n",error.localizedDescription.UTF8String);exit(5);}
  SCWindow *selected=nil;
  for(SCWindow *w in content.windows){
   NSString *bundle=w.owningApplication.bundleIdentifier?:@"";
   if(list&&([bundle localizedCaseInsensitiveContainsString:@"steam"]||[bundle containsString:@"screensaver"]||[bundle containsString:@"sas.capture"]))printf("%u | %s | %s | %.0fx%.0f\n",w.windowID,bundle.UTF8String,(w.title?:@"").UTF8String,w.frame.size.width,w.frame.size.height);
   if(w.windowID==wanted)selected=w;
  }
  if(list){fflush(stdout);exit(0);}
  if(!selected){fprintf(stderr,"Selected window not found.\n");exit(6);}
  capture.sourceWidth=selected.frame.size.width;capture.sourceHeight=selected.frame.size.height;
  SCContentFilter *filter=[[SCContentFilter alloc]initWithDesktopIndependentWindow:selected];
  SCStreamConfiguration *config=[SCStreamConfiguration new];
  config.includeChildWindows=YES;config.ignoreShadowsDisplay=YES;config.ignoreShadowsSingleWindow=YES;config.width=1920;config.height=1080;config.minimumFrameInterval=CMTimeMake(1,60);config.queueDepth=8;config.showsCursor=YES;config.capturesAudio=NO;config.preservesAspectRatio=YES;config.captureResolution=SCCaptureResolutionBest;config.backgroundColor=CGColorCreateGenericRGB(0.025,0.04,0.06,1);
  capture.stream=[[SCStream alloc]initWithFilter:filter configuration:config delegate:capture];
  NSError *addError=nil;
  [capture.stream addStreamOutput:capture type:SCStreamOutputTypeScreen sampleHandlerQueue:dispatch_get_main_queue() error:&addError];
  if(addError){fprintf(stderr,"Sample monitor: %s\n",addError.localizedDescription.UTF8String);exit(7);}
  SCRecordingOutputConfiguration *out=[SCRecordingOutputConfiguration new];out.outputURL=[NSURL fileURLWithPath:[NSString stringWithUTF8String:argv[2]]];out.videoCodecType=AVVideoCodecTypeH264;out.outputFileType=AVFileTypeMPEG4;
  capture.output=[[SCRecordingOutput alloc]initWithConfiguration:out delegate:capture];
  if(![capture.stream addRecordingOutput:capture.output error:&addError]){fprintf(stderr,"Output: %s\n",addError.localizedDescription.UTF8String);exit(8);}
  [capture.stream startCaptureWithCompletionHandler:^(NSError *error){if(error){fprintf(stderr,"Start: %s\n",error.localizedDescription.UTF8String);exit(9);}}];
 }];
 signal(SIGINT,SIG_IGN);dispatch_source_t sig=dispatch_source_create(DISPATCH_SOURCE_TYPE_SIGNAL,SIGINT,0,dispatch_get_main_queue());dispatch_source_set_event_handler(sig,^{[capture stop];});dispatch_resume(sig);
 [[NSRunLoop mainRunLoop]run];
}return 0;}
